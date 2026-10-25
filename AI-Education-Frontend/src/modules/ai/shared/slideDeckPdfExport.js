import jsPDF from 'jspdf';

// Real hex values from tailwind.config.js — the same palette the on-
// screen deck renders with, so the exported PDF matches what the
// student actually sees rather than looking like a generic export.
const COLORS = {
  primary: '#283593',
  primaryDark: '#172554',
  onSurface: '#172033',
  onSurfaceVariant: '#64748B',
  success: '#16866A',
  background: '#F8F7F2',
};

const PAGE_W = 960;
const PAGE_H = 540;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

const SLIDE_TYPE_LABELS = {
  hook: 'Why does this matter?',
  concept: "Here's the idea",
  diagram: 'Look closely',
  worked_example: "Let's solve one",
  question: 'Your turn',
  recap: 'What you should remember',
};

// Downloads the real textbook figure as bytes so jsPDF can embed it
// directly (doc.addImage takes raw image data, not a URL) — no <canvas>
// involved, so this isn't subject to the canvas-tainting CORS failure
// mode a screenshot-based export approach would hit. A fetch failure
// (network hiccup, CORS) just means this one slide's PDF page skips the
// image — the rest of the deck still exports.
const fetchImageAsDataUrl = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const blob = await res.blob();
  const format = blob.type.includes('png') ? 'PNG' : 'JPEG';
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read image data'));
    reader.readAsDataURL(blob);
  });
  return { dataUrl, format };
};

const citationLine = (citation) => {
  if (!citation) return null;
  const page = typeof citation.page === 'number' ? ` · p. ${citation.page + 1}` : '';
  return `Source: ${citation.chapter || 'chapter'}${page}`;
};

// Same fixed quadrant layout as shared/slideVisuals.jsx's QuadrantDiagram
// — vector-drawn here (rect/line/text) rather than reusing the SVG
// component, since jsPDF draws its own primitives rather than rendering
// DOM. The chart itself is fixed/correct regardless of model input; only
// which quadrant gets highlighted is model-supplied.
const QUADRANTS = [
  { id: 'I', sign: '(+, +)', qx: 1, qy: 1 },
  { id: 'II', sign: '(-, +)', qx: -1, qy: 1 },
  { id: 'III', sign: '(-, -)', qx: -1, qy: -1 },
  { id: 'IV', sign: '(+, -)', qx: 1, qy: -1 },
];

const drawQuadrantDiagram = (doc, x, y, size, highlightQuadrant) => {
  const half = size / 2;
  QUADRANTS.forEach((q) => {
    const rectX = x + (q.qx > 0 ? half : 0);
    const rectY = y + (q.qy > 0 ? 0 : half);
    doc.setFillColor(q.id === highlightQuadrant ? '#FCEACB' : '#F1F5F9');
    doc.rect(rectX, rectY, half, half, 'F');
  });

  doc.setDrawColor(COLORS.onSurfaceVariant);
  doc.setLineWidth(1);
  doc.line(x + half, y, x + half, y + size);
  doc.line(x, y + half, x + size, y + half);

  QUADRANTS.forEach((q) => {
    const cx = x + (q.qx > 0 ? half + half / 2 : half / 2);
    const cy = y + (q.qy > 0 ? half / 2 : half + half / 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(COLORS.primaryDark);
    doc.text(q.id, cx, cy - 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(COLORS.onSurfaceVariant);
    doc.text(q.sign, cx, cy + 10, { align: 'center' });
  });
};

// Same axis-plot shape as shared/slideVisuals.jsx's AxisPlot component —
// point coordinates are whatever the model supplied (already required
// by SLIDE_DECK_PROMPT to match numbers stated elsewhere on the slide).
const drawAxisPlot = (doc, x, y, size, points) => {
  if (!points || points.length === 0) return;
  const padding = 22;
  const maxAbs = Math.max(1, ...points.map((p) => Math.abs(p.x)), ...points.map((p) => Math.abs(p.y)));
  const scale = (size / 2 - padding) / maxAbs;
  const toX = (px) => x + size / 2 + px * scale;
  const toY = (py) => y + size / 2 - py * scale;

  doc.setDrawColor(COLORS.onSurfaceVariant);
  doc.setLineWidth(1);
  doc.line(x, y + size / 2, x + size, y + size / 2);
  doc.line(x + size / 2, y, x + size / 2, y + size);

  points.forEach((p) => {
    doc.setFillColor(COLORS.primary);
    doc.circle(toX(p.x), toY(p.y), 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(COLORS.primaryDark);
    doc.text(`${p.label} (${p.x}, ${p.y})`, toX(p.x) + 6, toY(p.y) - 4);
  });
};

// A real textbook figure always wins over a generated visual — same
// priority order as SlideDeck.jsx's renderVisualBlock.
const drawVisual = (doc, visual, x, y, size) => {
  if (!visual || visual.kind === 'none') return false;
  if (visual.kind === 'quadrant_diagram') {
    drawQuadrantDiagram(doc, x, y, size, visual.data?.highlight_quadrant);
    return true;
  }
  if (visual.kind === 'axis_plot') {
    drawAxisPlot(doc, x, y, size, visual.data?.points);
    return true;
  }
  return false;
};

// Renders one slide's real content onto the current PDF page — plain
// jsPDF text/shape drawing (no DOM screenshot), so pagination and text
// wrapping are computed directly rather than depending on a captured
// image's fixed resolution.
const drawSlide = async (doc, slide, index, total) => {
  doc.setFillColor(COLORS.background);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  let y = MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(COLORS.primary);
  doc.text(
    `${(SLIDE_TYPE_LABELS[slide.type] || slide.type).toUpperCase()}   ·   SLIDE ${index + 1} OF ${total}`,
    MARGIN,
    y
  );
  y += 26;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(COLORS.primaryDark);
  const headingLines = doc.splitTextToSize(slide.heading || '', CONTENT_W);
  doc.text(headingLines, MARGIN, y);
  y += headingLines.length * 26 + 6;

  if (slide.subheading) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(COLORS.onSurfaceVariant);
    const subLines = doc.splitTextToSize(slide.subheading, CONTENT_W);
    doc.text(subLines, MARGIN, y);
    y += subLines.length * 15 + 10;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12.5);
  doc.setTextColor(COLORS.onSurface);

  const writeWrapped = (text, { indent = 0, lineHeight = 17, gapAfter = 8 } = {}) => {
    const lines = doc.splitTextToSize(text, CONTENT_W - indent);
    doc.text(lines, MARGIN + indent, y);
    y += lines.length * lineHeight + gapAfter;
  };

  if (slide.explanation) writeWrapped(slide.explanation);

  (slide.key_points || []).forEach((point) => writeWrapped(`•  ${point}`, { indent: 10, gapAfter: 6 }));
  (slide.steps || []).forEach((step, i) => writeWrapped(`${i + 1}.  ${step}`, { indent: 10, gapAfter: 6 }));

  if (slide.type === 'question') {
    if (slide.question) writeWrapped(slide.question, { gapAfter: 10 });
    ['A', 'B', 'C', 'D']
      .filter((key) => slide.options?.[key])
      .forEach((key) => {
        const isCorrect = key === slide.correct_answer;
        doc.setTextColor(isCorrect ? COLORS.success : COLORS.onSurface);
        doc.setFont('helvetica', isCorrect ? 'bold' : 'normal');
        writeWrapped(`${key})  ${slide.options[key]}${isCorrect ? '   ✓ Correct answer' : ''}`, {
          indent: 10,
          gapAfter: 6,
        });
      });
    doc.setFont('helvetica', 'normal');
    if (slide.explanation_after_answer) {
      y += 4;
      doc.setTextColor(COLORS.onSurfaceVariant);
      writeWrapped(slide.explanation_after_answer);
      doc.setTextColor(COLORS.onSurface);
    }
  }

  if (slide.image?.image_url) {
    try {
      const { dataUrl, format } = await fetchImageAsDataUrl(slide.image.image_url);
      const imgHeight = 190;
      const imgWidth = CONTENT_W * 0.62;
      doc.addImage(dataUrl, format, MARGIN, y, imgWidth, imgHeight, undefined, 'FAST');
      if (slide.image.caption) {
        doc.setFontSize(10);
        doc.setTextColor(COLORS.onSurfaceVariant);
        doc.text(doc.splitTextToSize(slide.image.caption, imgWidth), MARGIN, y + imgHeight + 16);
      }
      y += imgHeight + 30;
    } catch {
      // A figure that couldn't be fetched (network hiccup, CORS) just
      // means this page skips the image — the rest of the slide's real
      // content still exports.
    }
  } else {
    const drewVisual = drawVisual(doc, slide.visual, MARGIN, y, 150);
    if (drewVisual) y += 150 + 24;
  }

  const citation = citationLine(slide.citation);
  if (citation) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(COLORS.primary);
    doc.text(citation, MARGIN, PAGE_H - MARGIN / 2);
  }
};

// Exports the whole deck as one PDF, one landscape page per slide —
// real content drawn directly (heading/explanation/key points/steps/
// question+options/citation), with the deck's own real textbook figures
// embedded where a slide has one, not a screenshot of the UI.
export const exportSlideDeckToPdf = async (deck, chapterName) => {
  const slides = deck?.slides || [];
  if (slides.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [PAGE_W, PAGE_H] });

  for (let i = 0; i < slides.length; i++) {
    if (i > 0) doc.addPage([PAGE_W, PAGE_H], 'landscape');
    await drawSlide(doc, slides[i], i, slides.length);
  }

  const safeName = (chapterName || 'learning-deck').replace(/[^\w\- ]+/g, '').trim() || 'learning-deck';
  doc.save(`${safeName} — AI Learning Deck.pdf`);
};
