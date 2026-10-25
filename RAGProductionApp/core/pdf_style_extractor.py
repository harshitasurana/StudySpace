"""Font-aware PDF text extraction — structural anchors (real headings/bold
spans, derived from the PDF's own font size/boldness, not guessed from
bare words) for pipelines that need faithfully-transcribed chapter text.

The Chapter Reader itself no longer uses this — it renders the real PDF
directly in the browser (react-pdf/pdf.js) instead of transcribing it,
which is both faster and pixel-perfect (no risk of a reformatting pass
scrambling math notation). This module is kept because
core/chapter_reader_vision.py's read_chapter_page() still needs these
structural anchors as grounding for its own vision-based transcription,
used by pipelines that need real TEXT (not just a visual render) to work
with — e.g. extracting a chapter's real exercise questions.

The plain-text extraction used everywhere else (rag/data_loader.py's
load_pdf_pages, used by the main RAG ingestion pipeline) throws away every
bit of visual structure PyMuPDF can see - font size, boldness. This
module's heuristics are tuned specifically for "what does a reader page
look like structurally", not retrieval quality — load_pdf_pages itself is
deliberately NOT touched, the main RAG/embedding pipeline depends on its
exact output shape. This is a parallel extractor that returns the SAME
{page_index, page_label, text} shape, just for a different purpose.

Output convention (also documented in CHAPTER_PAGE_READ_PROMPT so a vision
transcription pass knows to preserve rather than reinvent these):
  - A line PyMuPDF reports as meaningfully larger than the page's own body
    text size becomes a Markdown heading ("## " or "### ", by how much
    larger).
  - A run of text PyMuPDF reports as bold gets wrapped in **bold**.
  - Running headers/footers (exact text repeated across many pages) and
    page-number footers are dropped outright.
"""

import re
from collections import Counter

import fitz  # PyMuPDF

BOLD_FLAG = 1 << 4  # fitz span "flags" bit 4 = bold (per PyMuPDF's font-flags convention)

# A line is a heading candidate once its dominant font size is at least
# this many times the page's own body-text size. Two thresholds give two
# heading levels; anything bigger than HEADING_MAJOR_RATIO is "##",
# anything between the two is "###".
HEADING_MAJOR_RATIO = 1.4
HEADING_MINOR_RATIO = 1.15
HEADING_MAX_WORDS = 15

# A line smaller than the body text (below this ratio) is auxiliary
# (running header, page number, diagram axis label/caption) rather than
# real prose, UNLESS it's long enough to plausibly be real content (e.g.
# many textbooks print exercise/example text slightly smaller than body).
CAPTION_RATIO = 0.95
CAPTION_MAX_WORDS = 2

# A line's exact text (case-insensitive, whitespace-collapsed) recurring on
# at least this fraction of the chapter's pages is treated as a repeated
# running header/footer and dropped wherever it appears.
REPEATED_LINE_MIN_PAGE_FRACTION = 0.3

_BULLET_RE = re.compile(r"^\s*(?:[-•‣◦⁃]\s+|\(?[ivxlcdm]+\)\s*|\d+[.)‧:]\s*|\(?\d+\)\s*)", re.IGNORECASE)
_DIGITS_ONLY_RE = re.compile(r"^[\divxlcdm\W]+$", re.IGNORECASE)
_WS_RE = re.compile(r"\s+")


def _normalize(text: str) -> str:
    # U+00AD SOFT HYPHEN is an invisible line-break hint in the original
    # PDF, never meant to render - PyMuPDF sometimes still surfaces it as
    # a literal character in extracted text.
    text = text.replace("­", "")
    return _WS_RE.sub(" ", text).strip()


def _strip_leading_folio_number(spans):
    """Some layouts place a bold page-number/folio digit visually flush
    with the start of the first body-text line on the page, so PyMuPDF
    groups them into one "line" with the real paragraph text - e.g. a
    line that reads "5 precise. Such failures ...". Drops a leading
    span that is short, digit-only, and followed by real (non-digit)
    content, before the rest of the line is classified normally."""
    if len(spans) < 2:
        return spans
    first = spans[0]
    first_text = first.get("text", "").strip()
    if first_text and first_text.isdigit() and len(first_text) <= 3:
        rest_text = "".join(s.get("text", "") for s in spans[1:]).strip()
        if rest_text and not rest_text[:1].isdigit():
            return spans[1:]
    return spans


def _collect_lines(doc):
    """One flat pass over the whole document: every text line, with its
    page index (0-based), dominant font size, whether every span on it is
    bold, and its normalized text. Table/image blocks (block type != 0)
    are skipped - only real text blocks carry font metadata worth reading."""
    lines = []
    for page_index, page in enumerate(doc):
        page_dict = page.get_text("dict")
        for block in page_dict.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                spans = [s for s in line.get("spans", []) if s.get("text", "").strip()]
                if not spans:
                    continue
                spans = _strip_leading_folio_number(spans)
                if not spans:
                    continue
                text = _normalize("".join(s["text"] for s in spans))
                if not text:
                    continue
                max_size = max(s["size"] for s in spans)
                all_bold = all(bool(s["flags"] & BOLD_FLAG) for s in spans)
                lines.append(
                    {
                        "page_index": page_index,
                        "text": text,
                        "size": max_size,
                        "all_bold": all_bold,
                        "spans": spans,
                    }
                )
    return lines


def _compute_body_size(lines) -> float:
    """The most common font size, weighted by character count - the
    document's own real body-text size, computed fresh per PDF rather than
    assumed, since different textbooks/publishers use different base
    sizes."""
    weights = Counter()
    for line in lines:
        weights[round(line["size"], 1)] += len(line["text"])
    if not weights:
        return 11.0
    return weights.most_common(1)[0][0]


def _compute_repeated_lines(lines, page_count) -> set:
    """Lines whose exact (normalized, lowercased) text shows up on enough
    distinct pages to be a running header/footer rather than real,
    page-specific content."""
    if page_count == 0:
        return set()
    seen_per_text = {}
    for line in lines:
        key = line["text"].lower()
        seen_per_text.setdefault(key, set()).add(line["page_index"])

    threshold = max(2, int(page_count * REPEATED_LINE_MIN_PAGE_FRACTION))
    return {text for text, pages in seen_per_text.items() if len(pages) >= threshold}


def _is_page_number_like(text: str) -> bool:
    words = text.split()
    return len(words) <= CAPTION_MAX_WORDS and bool(_DIGITS_ONLY_RE.match(text.replace(" ", "")))


def _wrap_bold_spans(spans) -> str:
    """Rebuilds a line's text from its spans, wrapping individually-bold
    spans in **bold** rather than the whole line - for a line that mixes a
    bold term into an otherwise-regular sentence."""
    parts = []
    for span in spans:
        text = span.get("text", "")
        if not text.strip():
            parts.append(text)
            continue
        if span["flags"] & BOLD_FLAG:
            parts.append(f"**{text.strip()}**")
        else:
            parts.append(text)
    return _normalize("".join(parts))


def _classify_line(line, body_size, repeated_lines):
    """Returns (kind, content) where kind is one of:
    "drop", "heading2", "heading3", "bullet", "paragraph"."""
    text = line["text"]
    ratio = line["size"] / body_size if body_size else 1.0
    word_count = len(text.split())

    # A bare folio/page number, printed on its own line - some textbooks
    # set these in a large or bold font (indistinguishable from a heading
    # by size/boldness alone), so this check runs regardless of ratio,
    # ahead of the heading check below.
    if word_count == 1 and len(text) <= 4 and text.isdigit():
        return "drop", None

    if text.lower() in repeated_lines:
        return "drop", None
    if ratio <= CAPTION_RATIO and (word_count <= CAPTION_MAX_WORDS or _is_page_number_like(text)):
        return "drop", None
    if ratio <= CAPTION_RATIO and word_count <= CAPTION_MAX_WORDS + 1:
        # Small-font, still-short fragment (e.g. a lone figure label) that
        # slipped past the repeated-line check - treat as noise too rather
        # than dropping it into the middle of a paragraph.
        return "drop", None

    if ratio >= HEADING_MINOR_RATIO and word_count <= HEADING_MAX_WORDS:
        level = "heading2" if ratio >= HEADING_MAJOR_RATIO else "heading3"
        return level, text

    if _BULLET_RE.match(text):
        content = _wrap_bold_spans(line["spans"]) if line["all_bold"] is False else f"**{text}**"
        return "bullet", content

    content = _wrap_bold_spans(line["spans"]) if not line["all_bold"] else f"**{text}**"
    return "paragraph", content


def _join_wrapped(previous: str, addition: str) -> str:
    """Rejoins a line broken mid-word by PDF text-wrapping (a hyphen at the
    end of one line, continued on the next) without the hyphen or an extra
    space; otherwise joins with a single space, done deterministically
    here rather than left for an LLM cleanup pass to catch best-effort."""
    if previous.endswith("-") and addition[:1].islower():
        return previous[:-1] + addition
    return f"{previous} {addition}"


def _render_page_text(page_lines, body_size, repeated_lines) -> str:
    blocks = []  # list of (kind, [content, ...])
    for line in page_lines:
        kind, content = _classify_line(line, body_size, repeated_lines)
        if kind == "drop":
            continue

        if kind in ("heading2", "heading3"):
            # A heading that wraps onto a second PDF line (e.g. a long
            # chapter title) shows up as two consecutive same-level
            # headings - merge rather than emitting two separate ones.
            if blocks and blocks[-1][0] == kind:
                blocks[-1][1][0] = f"{blocks[-1][1][0]} {content}"
            else:
                blocks.append((kind, [content]))
            continue

        if kind == "bullet":
            blocks.append((kind, [content]))
            continue

        # paragraph: a continuation line of whatever came before it (a
        # wrapped sentence, or the rest of a multi-line list item) - merge
        # into that block's text rather than starting a new one, so a list
        # item's wrapped continuation stays part of that same item instead
        # of falling out as an orphaned, unindented paragraph.
        if blocks and blocks[-1][0] in ("paragraph", "bullet"):
            blocks[-1][1][0] = _join_wrapped(blocks[-1][1][0], content)
        else:
            blocks.append(("paragraph", [content]))

    rendered = []
    for kind, parts in blocks:
        if kind == "heading2":
            rendered.append(f"## {parts[0]}")
        elif kind == "heading3":
            rendered.append(f"### {parts[0]}")
        elif kind == "bullet":
            rendered.append(f"- {parts[0]}")
        else:
            rendered.append(parts[0])

    return "\n\n".join(rendered)


def extract_chapter_pdf_pages(path: str) -> list[dict]:
    """Same return shape as rag.data_loader.load_pdf_pages
    ([{page_index, page_label, text}, ...], 1-based page_index) but text
    is pre-annotated Markdown (## / ### headings, **bold** spans) driven by
    the PDF's own real font metadata, with running headers/footers and
    page-number noise already stripped - see module docstring.

    Also carries `pdf_page_index` — the real 0-based fitz page index this
    entry came from, distinct from `page_index` (a 1-based counter over
    only the non-blank pages that survived, i.e. NOT the same number
    once any page was skipped for being blank). core/chapter_reader_vision.py
    needs the real index to render this exact page's image for a vision
    read; nothing else in this module ever needed it before."""
    doc = fitz.open(path)
    try:
        all_lines = _collect_lines(doc)
        body_size = _compute_body_size(all_lines)
        repeated_lines = _compute_repeated_lines(all_lines, doc.page_count)

        lines_by_page = {}
        for line in all_lines:
            lines_by_page.setdefault(line["page_index"], []).append(line)

        pages = []
        index = 0
        for page_index in range(doc.page_count):
            page_lines = lines_by_page.get(page_index, [])
            text = _render_page_text(page_lines, body_size, repeated_lines)
            if not text.strip():
                continue
            index += 1
            pages.append(
                {
                    "page_index": index,
                    "pdf_page_index": page_index,
                    "page_label": doc[page_index].get_label() or str(page_index + 1),
                    "text": text,
                }
            )
        return pages
    finally:
        doc.close()
