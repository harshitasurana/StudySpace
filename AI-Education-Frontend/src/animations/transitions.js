export const easing = [0.2, 0.8, 0.2, 1];

export const transitions = {
  fast: { duration: 0.16, ease: easing },
  normal: { duration: 0.24, ease: easing },
  slow: { duration: 0.60, ease: easing },
  milestone: { duration: 0.90, ease: easing },
  spring: { type: 'spring', stiffness: 300, damping: 25 },
};
