import React from 'react';

// Fixed, hand-built SVG diagrams for AI Learning Deck's "visual" fallback
// (see SlideDeck.jsx) — deliberately NOT a charting library, since both
// shapes are small and fixed. These render a *generated illustration*,
// never a real textbook figure — SlideDeck.jsx only reaches for these
// when no real figure (slide.image) is present, and they carry no
// citation/page badge, unlike a real figure.

const QUADRANTS = [
  { id: 'I', sign: '(+, +)', qx: 1, qy: 1 },
  { id: 'II', sign: '(-, +)', qx: -1, qy: 1 },
  { id: 'III', sign: '(-, -)', qx: -1, qy: -1 },
  { id: 'IV', sign: '(+, -)', qx: 1, qy: -1 },
];

// A four-quadrant coordinate sign chart — the chart itself (I-IV and
// their signs) is a fixed, universally-true structure rendered from
// this template, not from anything the model supplied; the model only
// ever picks whether to show this and, optionally, which quadrant to
// highlight (highlightQuadrant), so there's no way for it to invent a
// wrong sign pattern.
export const QuadrantDiagram = ({ highlightQuadrant, light }) => {
  const size = 220;
  const half = size / 2;
  const axisClass = light ? 'stroke-white/50' : 'stroke-on-surface-variant';
  const labelClass = light ? 'fill-white' : 'fill-primary-dark';
  const signClass = light ? 'fill-white/80' : 'fill-on-surface-variant';

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px] mx-auto" role="img" aria-label="Four-quadrant coordinate sign chart">
      {QUADRANTS.map((q) => {
        const isHighlighted = highlightQuadrant === q.id;
        const rectX = q.qx > 0 ? half : 0;
        const rectY = q.qy > 0 ? 0 : half;
        return (
          <rect
            key={q.id}
            x={rectX}
            y={rectY}
            width={half}
            height={half}
            className={isHighlighted ? 'fill-accent/30' : light ? 'fill-white/5' : 'fill-primary/5'}
          />
        );
      })}
      <line x1={half} y1={0} x2={half} y2={size} className={axisClass} strokeWidth="1.5" />
      <line x1={0} y1={half} x2={size} y2={half} className={axisClass} strokeWidth="1.5" />
      {QUADRANTS.map((q) => {
        const cx = q.qx > 0 ? half + half / 2 : half / 2;
        const cy = q.qy > 0 ? half / 2 : half + half / 2;
        return (
          <g key={q.id}>
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="13" fontWeight="700" className={labelClass}>{q.id}</text>
            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" className={signClass}>{q.sign}</text>
          </g>
        );
      })}
    </svg>
  );
};

// A small labeled x/y axis plot for one or more points — points come
// from the model (data.points), but SLIDE_DECK_PROMPT requires their
// coordinates to already match numbers stated elsewhere on the same
// slide, so this is a visualization of already-generated content, not a
// new source of invented facts.
export const AxisPlot = ({ points, light }) => {
  if (!points || points.length === 0) return null;
  const size = 220;
  const padding = 30;
  const maxAbs = Math.max(1, ...points.map((p) => Math.abs(p.x)), ...points.map((p) => Math.abs(p.y)));
  const scale = (size / 2 - padding) / maxAbs;
  const toSvgX = (x) => size / 2 + x * scale;
  const toSvgY = (y) => size / 2 - y * scale;
  const axisClass = light ? 'stroke-white/50' : 'stroke-on-surface-variant';
  const dotClass = light ? 'fill-accent' : 'fill-primary';
  const labelClass = light ? 'fill-white' : 'fill-primary-dark';

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px] mx-auto" role="img" aria-label="Coordinate axis plot">
      <line x1={0} y1={size / 2} x2={size} y2={size / 2} className={axisClass} strokeWidth="1.5" />
      <line x1={size / 2} y1={0} x2={size / 2} y2={size} className={axisClass} strokeWidth="1.5" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={toSvgX(p.x)} cy={toSvgY(p.y)} r={4.5} className={dotClass} />
          <text x={toSvgX(p.x) + 8} y={toSvgY(p.y) - 6} fontSize="12" fontWeight="600" className={labelClass}>
            {p.label} ({p.x}, {p.y})
          </text>
        </g>
      ))}
    </svg>
  );
};

// Dispatches a slide's `visual` field to the right component — returns
// null for "none"/unrecognized kinds or missing data, so callers can
// render it unconditionally.
export const SlideVisual = ({ visual, light }) => {
  if (!visual || visual.kind === 'none') return null;
  if (visual.kind === 'quadrant_diagram') {
    return <QuadrantDiagram highlightQuadrant={visual.data?.highlight_quadrant} light={light} />;
  }
  if (visual.kind === 'axis_plot') {
    return <AxisPlot points={visual.data?.points} light={light} />;
  }
  return null;
};
