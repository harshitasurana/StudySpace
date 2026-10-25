import React, { useEffect, useState } from 'react';

// Progress bars that animate from 0 to their real value on mount instead
// of snapping straight in.
const AnimatedBar = ({ value = 0, barClassName = 'bg-primary', trackClassName = 'bg-surface-container' }) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 50);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className={`w-full h-2 rounded-full overflow-hidden ${trackClassName}`}>
      <div
        className={`h-full rounded-full transition-all duration-1000 ease-out ${barClassName}`}
        style={{ width: `${width}%` }}
      ></div>
    </div>
  );
};

export default AnimatedBar;
