// DOM helpers for the Chapter Reader's highlighter. Highlights are stored
// as plain text (see AI-Education-Backend's education_chapter_highlights —
// same "copy the real text" pattern as Notes/Bookmarks, not a live
// position/offset into the markdown, which would break the moment content
// is regenerated). These helpers re-locate that saved text inside the
// current rendered DOM and wrap it, and wrap a live user selection the
// same way for instant feedback.

// Walks every text node under `root` and returns the fully flattened text
// plus a per-character lookup back to which (node, offset) it came from —
// lets a saved highlight's plain text be found and wrapped correctly even
// when it spans multiple text nodes (e.g. a highlight crossing a **bold**
// boundary, which Markdown rendering splits into separate DOM text nodes).
//
// Also walks <br> elements and inserts a matching "\n" — pdf.js's real
// text layer (react-pdf's <Page>) places one <br> after every line, and
// window.getSelection().toString() (what a saved highlight's text was
// captured with) renders each of those as "\n". Skipping <br> here would
// flatten the index with zero separators, so a saved highlight spanning
// more than one line could never be found again via the plain substring
// search below (confirmed: text.indexOf(savedText) === -1 for any
// multi-line highlight without this). The synthetic "\n" is glued to the
// offset just past the preceding text run since a match's start/end never
// actually lands on it — only ever passes through it mid-string.
export const buildTextIndex = (root) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
      node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
  });
  let text = '';
  const map = [];
  let lastEntry = null;
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.textContent || '';
      for (let i = 0; i < nodeText.length; i += 1) {
        const entry = { node, offset: i };
        map.push(entry);
        lastEntry = entry;
      }
      text += nodeText;
    } else {
      text += '\n';
      map.push(lastEntry ? { node: lastEntry.node, offset: lastEntry.offset + 1 } : { node, offset: 0 });
    }
    node = walker.nextNode();
  }
  return { text, map };
};

// Finds the first occurrence of `searchText` under `root` and returns a
// Range spanning it, or null if it isn't present (e.g. this highlight
// belongs to a different page, or the chapter's content was regenerated
// and no longer contains this exact wording).
export const findRangeForText = (root, searchText) => {
  if (!root || !searchText) return null;
  const { text, map } = buildTextIndex(root);
  const idx = text.indexOf(searchText);
  if (idx === -1) return null;
  const start = map[idx];
  const end = map[idx + searchText.length - 1];
  if (!start || !end) return null;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset + 1);
  return range;
};

// Renders `range` as one or more absolutely-positioned overlay rectangles
// inside `overlayRoot` (one per visual line the range spans, via
// Range.getClientRects()) instead of wrapping the underlying text.
//
// Wrapping the text directly (this used to be a <mark>-wrapping
// `wrapRangeInMarks`, via Range.surroundContents-per-text-node) doesn't
// work against pdf.js's text layer: every real span there carries an
// inline `transform: scaleX(...)` (font-metric correction so the
// invisible text lines up with the canvas's actual glyph widths).
// `transform` creates a new stacking context / GPU compositing layer, and
// mix-blend-mode on an element nested inside one only blends within that
// layer — it can never reach the canvas painted behind it (confirmed
// empirically: a <mark> there didn't tint the text, it fully hid it).
// Rendering the highlight as separate rects appended to `overlayRoot` — a
// plain, untransformed sibling of the canvas (see ChapterReader.jsx's
// <Page> children), not nested inside any transformed span — lets
// mix-blend-mode correctly blend against the real rendered page, so dark
// text stays legible under a translucent tint instead of being covered or
// washed out by flat alpha.
// className overrides the default saved-highlight styling — used by
// Search (chapter-search-match-overlay) and Read-Aloud's "currently
// speaking" sentence (chapter-speech-overlay), both of which render into
// their OWN dedicated overlay root (never highlightOverlayRef) so a
// highlights re-fetch/re-render can't wipe either of them out, and vice
// versa.
export const renderHighlightOverlay = (overlayRoot, range, { color, highlightId, className } = {}) => {
  if (!overlayRoot || !range) return [];
  const overlayBounds = overlayRoot.getBoundingClientRect();
  const marks = [];
  Array.from(range.getClientRects()).forEach((rect) => {
    if (rect.width === 0 || rect.height === 0) return;
    const div = document.createElement('div');
    div.className = className || `chapter-highlight-overlay chapter-highlight-${color || 'yellow'}`;
    if (highlightId != null) div.dataset.highlightId = String(highlightId);
    div.style.left = `${rect.left - overlayBounds.left}px`;
    div.style.top = `${rect.top - overlayBounds.top}px`;
    div.style.width = `${rect.width}px`;
    div.style.height = `${rect.height}px`;
    overlayRoot.appendChild(div);
    marks.push(div);
  });
  return marks;
};

// Removes every previously-rendered highlight overlay under `overlayRoot`
// — run before re-rendering the current highlight list so page switches
// never leave stale rects from a previous page's content.
// selector defaults to the saved-highlight class so every existing call
// site's behavior is unchanged; Search/Read-Aloud pass their own overlay's
// class since they share this same removal logic but never each other's
// DOM.
export const clearHighlightOverlay = (overlayRoot, selector = '.chapter-highlight-overlay') => {
  if (!overlayRoot) return;
  overlayRoot.querySelectorAll(selector).forEach((el) => el.remove());
};
