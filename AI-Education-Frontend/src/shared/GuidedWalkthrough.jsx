import React from 'react';
import { Joyride, STATUS, EVENTS } from 'react-joyride';

// Self-mode-only, one-time interactive UI tour shown right after the Self
// Student onboarding wizard completes (see StudentDashboardBase.jsx, which
// decides *whether* to run this from profile.guided_walkthrough_seen_at —
// this component only renders the steps and reports back when the student
// is done with them, never decides on its own to show itself).
//
// IMPORTANT — this was built against react-joyride v2's API by mistake;
// v3.2.0 (the version actually installed, see package.json) renamed or
// removed several props this component originally used, and every one of
// them was silently ignored rather than erroring, so the bugs were only
// visible at runtime, not at build/lint time. Confirmed directly against
// node_modules/react-joyride/dist/index.d.mts, not guessed:
//   - Step.disableBeacon -> Step.skipBeacon (every step showed the
//     untouched default beacon regardless of what disableBeacon was set
//     to — that beacon is identifiable by its built-in accessible label
//     "Open the dialog", react-joyride's defaultLocale.open).
//   - Props.callback -> Props.onEvent (the old callback prop doesn't
//     exist in v3 at all, so the handler here was NEVER once invoked —
//     marking the walkthrough "seen" server-side never actually fired,
//     for any reason, which is why it kept reappearing on every refresh).
//   - Props.showProgress / Props.showSkipButton (top-level) don't exist
//     in v3 — both moved under the `options` prop, and showSkipButton
//     specifically doesn't exist in any form: which buttons render is
//     controlled by `options.buttons` (default ['back','close','primary'],
//     which excludes 'skip' unless added explicitly).
//
// Each step's `target` is a `data-tour="..."` hook added directly on the
// real UI element being pointed at (Sidebar.jsx, Topbar.jsx,
// StudentDashboardBase.jsx) rather than a fragile CSS class selector.
const STEPS = [
  {
    target: '[data-tour="sidebar-nav"]',
    title: 'Your menu',
    content: 'Everything you need lives here — My Learning, AI Tutor, Practice, and more.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="topbar-search"]',
    title: 'Search anything',
    content: 'Look up a subject, chapter, note, or bookmark from anywhere in the app.',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="topbar-notifications"]',
    title: 'Stay updated',
    content: 'Quiz results, mock test scores, and streak reminders show up here.',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="dashboard-student-code"]',
    title: 'Your Student Code',
    content: 'This is your unique code — share it if a teacher ever needs to look up your progress.',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="dashboard-mission"]',
    title: "Today's Mission",
    content: 'Your daily recommendation — a quick, focused task picked from your weakest chapter to help you improve fastest.',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="dashboard-continue-learning"]',
    title: 'Pick up where you left off',
    content: "Once you start a chapter, it'll show up here so you can jump straight back in.",
    placement: 'top',
    skipBeacon: true,
  },
  {
    target: '[data-tour="sidebar-help"]',
    title: 'Need help?',
    content: 'The Help Center has guides and an assistant if you ever get stuck.',
    placement: 'right',
    skipBeacon: true,
  },
];

// Rendered ONLY while it should actually be running (see
// StudentDashboardBase.jsx: `{runWalkthrough && <GuidedWalkthrough ... />}`,
// not `run={runWalkthrough}` on an always-mounted instance) — Joyride
// starts fully unmounted and mounts fresh exactly once the tour should
// start, rather than sitting mounted-but-idle the whole time a student
// is on the dashboard.
const GuidedWalkthrough = ({ onFinish }) => {
  const handleEvent = (data) => {
    // EVENTS.TOUR_END is the authoritative "the tour has concluded"
    // signal regardless of *why* (finished every step, used the Skip
    // button, or closed on the last step) — the STATUS checks are kept
    // alongside it as a harmless redundant safety net, not the primary
    // signal. Calling onFinish more than once is harmless (both the
    // parent's setRunWalkthrough(false) and markGuidedWalkthroughSeen
    // are idempotent), so overlap here is fine.
    if (data.type === EVENTS.TOUR_END || data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      onFinish();
    }
  };

  return (
    <Joyride
      run
      steps={STEPS}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={{
        showProgress: true,
        buttons: ['back', 'close', 'primary', 'skip'],
        primaryColor: '#002045',
        zIndex: 10000,
      }}
      locale={{ back: 'Back', close: 'Close', last: 'Done', next: 'Next', skip: 'Skip tour' }}
    />
  );
};

export default GuidedWalkthrough;
