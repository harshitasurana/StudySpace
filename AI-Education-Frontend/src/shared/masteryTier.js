// Shared 4-tier mastery bucketing, extracted from SubjectProgress.jsx's
// difficulty-heatmap thresholds (its `heatColor()`) so this exact
// definition of "what counts as mastered" is used everywhere a mastery %
// is shown as a qualitative tier (SubjectProgress.jsx's heatmap,
// StudentDashboardBase.jsx's per-chapter progress list) instead of
// drifting between two independently-defined copies.
export const MASTERY_TIERS = {
  MASTERED: 'mastered',
  NEEDS_PRACTICE: 'needs_practice',
  STRUGGLING: 'struggling',
  NOT_STARTED: 'not_started',
};

export const getMasteryTier = (mastery) => {
  if (mastery >= 80) return MASTERY_TIERS.MASTERED;
  if (mastery >= 50) return MASTERY_TIERS.NEEDS_PRACTICE;
  if (mastery > 0) return MASTERY_TIERS.STRUGGLING;
  return MASTERY_TIERS.NOT_STARTED;
};

export const MASTERY_TIER_EMOJI = {
  [MASTERY_TIERS.MASTERED]: '🟢',
  [MASTERY_TIERS.NEEDS_PRACTICE]: '🟡',
  [MASTERY_TIERS.STRUGGLING]: '🔴',
  [MASTERY_TIERS.NOT_STARTED]: '⚪',
};

// Matches SubjectProgress.jsx's original heatColor() classes exactly.
export const MASTERY_TIER_CLASSES = {
  [MASTERY_TIERS.MASTERED]: 'bg-success-mastery text-white',
  [MASTERY_TIERS.NEEDS_PRACTICE]: 'bg-orange-400 text-white',
  [MASTERY_TIERS.STRUGGLING]: 'bg-error text-white',
  [MASTERY_TIERS.NOT_STARTED]: 'bg-surface-container text-on-surface-variant',
};
