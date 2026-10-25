import React from 'react';

// Radial counterpart to AnimatedBar.jsx — used anywhere a compact, real
// percentage needs to read as a ring rather than a linear bar (Subjects
// cards, Student Dashboard). `size` controls the rendered box (px);
// stroke width and font size scale with it automatically.
const ProgressRing = ({ percent, size = 48 }) => {
  const radius = size * 0.34;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const strokeWidth = Math.max(2, size * 0.07);
  const fontSize = Math.max(9, size * 0.22);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, transform: 'rotate(-90deg)' }}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-surface-container" />
        <circle
          cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round"
          className="text-primary transition-all duration-1000 ease-out"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-bold text-primary" style={{ fontSize }}>
        {percent}%
      </span>
    </div>
  );
};

export default ProgressRing;
