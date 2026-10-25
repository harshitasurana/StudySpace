// A short two-note chime, synthesized directly with the Web Audio API —
// no binary asset to bundle/host, and it's cheap enough to build fresh
// per play. Reuses one AudioContext across calls (creating one per play
// would leak); lazily created on first real play() so the constructor
// never runs before a user gesture has happened (see playNotificationChime).
let sharedContext = null;
const getContext = () => {
  if (!sharedContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    sharedContext = new AudioContextClass();
  }
  return sharedContext;
};

const playTone = (ctx, { frequency, startTime, duration, peakGain = 0.18 }) => {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  // Short attack/release envelope instead of a hard on/off — a raw
  // square-edged gain change on a sine tone produces an audible click.
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
};

/**
 * Plays a short "ding-ding" (two ascending notes, ~350ms total) for a new
 * notification. Browsers block audio from starting before the user has
 * interacted with the page at all (autoplay policy) — that first call
 * will simply do nothing (AudioContext stays 'suspended'), which is the
 * correct, silent-failure behavior here: there's no notification worth
 * interrupting a page load for anyway. Every call after the user's first
 * real interaction (a click anywhere, per the browser's own tracking, not
 * anything this function needs to detect itself) plays normally.
 */
export const playNotificationChime = () => {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    playTone(ctx, { frequency: 880, startTime: now, duration: 0.14 }); // A5
    playTone(ctx, { frequency: 1318.5, startTime: now + 0.12, duration: 0.18 }); // E6
  } catch {
    // Never let a sound failure break the actual notification delivery.
  }
};

/**
 * Plays a celebratory three-note fanfare chime (~500ms) for XP gains, chapter completions,
 * and streak achievements.
 */
export const playFanfareChime = () => {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    playTone(ctx, { frequency: 523.25, startTime: now, duration: 0.12 }); // C5
    playTone(ctx, { frequency: 659.25, startTime: now + 0.10, duration: 0.14 }); // E5
    playTone(ctx, { frequency: 783.99, startTime: now + 0.22, duration: 0.16 }); // G5
    playTone(ctx, { frequency: 1046.50, startTime: now + 0.36, duration: 0.28 }); // C6
  } catch {
    // Silent fallback
  }
};

