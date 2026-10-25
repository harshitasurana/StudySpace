import { lazy } from 'react';

// Same hoisting reason documented below — both /settings and
// /settings/general-settings (the exact seeded router_link for Feature
// 311 "General Settings") render this same page.
const SettingsComponent = lazy(() => import('../modules/settings/pages/Settings'));

// Public / unauthenticated routes, rendered inside AuthLayout.
export const authRoutes = [
  { path: '/login', Component: lazy(() => import('../modules/authentication/pages/Login')) },
  { path: '/signup', Component: lazy(() => import('../modules/authentication/pages/Signup')) },
  { path: '/forgot-password', Component: lazy(() => import('../modules/authentication/pages/ForgotPassword')) },
  { path: '/reset-password', Component: lazy(() => import('../modules/authentication/pages/ResetPassword')) },
  // Legal documents — linked from both the landing page footer (logged
  // out) and the in-app footer (logged in), so they need to be reachable
  // regardless of auth state. AuthLayout has no auth-state redirect logic
  // of its own, which is exactly what makes it the right home for these.
  { path: '/privacy-policy', Component: lazy(() => import('../modules/legal/pages/PrivacyPolicy')) },
  { path: '/terms-of-service', Component: lazy(() => import('../modules/legal/pages/TermsOfService')) },
  { path: '/dpdp-consent', Component: lazy(() => import('../modules/legal/pages/DPDPConsent')) },
  { path: '/security-statement', Component: lazy(() => import('../modules/legal/pages/SecurityStatement')) },
];

// Authenticated routes, rendered inside MainLayout and gated by role.
// roles: null/omitted = any authenticated role may access.
export const protectedRoutes = [
  // Education onboarding - shown right after signup/login for a user who
  // hasn't picked a role yet, or a student who hasn't completed onboarding.
  // roles: null so it works for the default role_id=4 (no role set yet).
  {
    path: '/education/onboarding/role',
    Component: lazy(() => import('../features/education/onboarding/RoleSelectionPage')),
    roles: null,
  },
  {
    // Wildcard-ish: the wizard manages its own internal steps rather than
    // separate routes, so one route covers
    // /self/class, /self/board, /self/subjects, /self/preferences, /self/summary.
    // 'school student' role users never land here - Role Selection forks
    // straight into the matching wizard now (no shared mode-picker step).
    path: '/education/onboarding/student/self/*',
    Component: lazy(() => import('../features/education/onboarding/SelfStudentWizard')),
    roles: ['student'],
  },
  {
    // School Student's own entry point, exclusive to that role for the
    // same reason as self/* above - these two wizards are mutually
    // exclusive onboarding paths, not a shared feature both roles use.
    path: '/education/onboarding/student/school/*',
    Component: lazy(() => import('../features/education/onboarding/SchoolStudentWizard')),
    roles: ['school student'],
  },
  {
    // New mode-split home pages (Sprint 1 Track B). Previously
    // /student-portal sat here as a mode-agnostic fallback while a
    // student's learning_mode was unknown - removed because it confused
    // users (looked like a third, separate dashboard rather than a
    // loading/fallback state). A student without a resolved mode now goes
    // to onboarding instead - see defaultRouteForRole below.
    path: '/self/dashboard',
    Component: lazy(() => import('../modules/student/self/pages/SelfDashboard')),
    roles: ['student'],
    modes: ['self'],
  },
  {
    // 'student' kept alongside 'school student' defensively (a 'student'
    // role account with a stale learning_mode='school' from before the
    // School Student role existed would still resolve here) - modes still
    // does the real gating either way.
    path: '/school/dashboard',
    Component: lazy(() => import('../modules/student/school/pages/SchoolDashboard')),
    roles: ['student', 'school student'],
    modes: ['school'],
  },
  {
    path: '/curriculum',
    Component: lazy(() => import('../modules/curriculum/pages/Curriculum')),
    roles: ['student', 'school student'],
  },
  {
    path: '/pre-assessment',
    Component: lazy(() => import('../modules/assessment/pages/PreAssessment')),
    roles: ['student', 'school student'],
  },
  {
    path: '/pre-assessment/:chapterId',
    Component: lazy(() => import('../modules/assessment/pages/PreAssessment')),
    roles: ['student', 'school student'],
  },
  {
    path: '/lesson-heron',
    Component: lazy(() => import('../modules/ai/pages/LessonHeron')),
    roles: ['student', 'school student'],
  },
  {
    path: '/practice',
    Component: lazy(() => import('../modules/assessment/pages/Practice')),
    roles: ['student', 'school student'],
  },
  {
    path: '/challenge',
    Component: lazy(() => import('../modules/assessment/pages/Practice')),
    roles: ['student', 'school student'],
  },
  {
    // Sprint 1 task 1 - was missing, blocking Phase 0's paused
    // show_in_menu flag on feature 290 from ever being flipped on safely.
    path: '/practice/by-topic',
    Component: lazy(() => import('../modules/practice/pages/ByTopic')),
    roles: ['student', 'school student'],
  },
  {
    // Sprint 1 task 2 - feature 291 is show_in_menu=true today with no
    // matching route, so it currently 404s for real students.
    path: '/practice/by-subject',
    Component: lazy(() => import('../modules/practice/pages/BySubject')),
    roles: ['student', 'school student'],
  },
  {
    // Reached from Practice's "Previous Mistakes" and Test History's
    // "Wrong Questions"/"Mistake Replay" — no Feature row, same reasoning
    // as /flashcards, /mind-map above.
    path: '/practice/mistakes',
    Component: lazy(() => import('../modules/quiz/pages/MistakesReview')),
    roles: ['student', 'school student'],
  },
  {
    // Reached from Practice's "My Quizzes" link — every quiz this student
    // has generated, across every subject, with Reattempt/Retry actions.
    // No Feature row, same reasoning as /practice/mistakes above.
    path: '/practice/my-quizzes',
    Component: lazy(() => import('../modules/quiz/pages/MyQuizzes')),
    roles: ['student', 'school student'],
  },
  {
    // Every flashcard set this student has generated, with Generate New —
    // same shape as /practice/my-quizzes above. Has a Feature row (see
    // 20260910g_add_my_flashcards_mindmaps_decks_menu.sql), unlike the
    // "no Feature row" routes elsewhere on this page.
    path: '/practice/my-flashcards',
    Component: lazy(() => import('../modules/flashcards/pages/MyFlashcards')),
    roles: ['student', 'school student'],
  },
  {
    path: '/practice/my-mind-maps',
    Component: lazy(() => import('../modules/ai/pages/MyMindMaps')),
    roles: ['student', 'school student'],
  },
  {
    path: '/practice/my-learning-decks',
    Component: lazy(() => import('../modules/ai/pages/MyLearningDecks')),
    roles: ['student', 'school student'],
  },
  {
    // No Feature row / menu entry — reached contextually from a chapter's
    // own action buttons (Learning Path, Chapters), not the top-level
    // sidebar. canRoute() treats a path with no matching feature as
    // unrestricted, so this is still real/reachable, just not menu-listed.
    path: '/flashcards',
    Component: lazy(() => import('../modules/flashcards/pages/Flashcards')),
    roles: ['student', 'school student'],
  },
  {
    path: '/flashcards/:chapterId',
    Component: lazy(() => import('../modules/flashcards/pages/Flashcards')),
    roles: ['student', 'school student'],
  },
  {
    // Same reasoning as /flashcards above — reached from Tutor Chat's
    // "Generate Mind Map" action, not the top-level sidebar.
    path: '/mind-map',
    Component: lazy(() => import('../modules/ai/pages/MindMap')),
    roles: ['student', 'school student'],
  },
  {
    path: '/mind-map/:chapterId',
    Component: lazy(() => import('../modules/ai/pages/MindMap')),
    roles: ['student', 'school student'],
  },
  {
    // Same reasoning as /flashcards and /mind-map above — reached from
    // Tutor Chat's "Generate Learning Deck" action, not the top-level
    // sidebar.
    path: '/slide-deck',
    Component: lazy(() => import('../modules/ai/pages/SlideDeck')),
    roles: ['student', 'school student'],
  },
  {
    path: '/slide-deck/:chapterId',
    Component: lazy(() => import('../modules/ai/pages/SlideDeck')),
    roles: ['student', 'school student'],
  },
  {
    // Same reasoning as /mind-map and /slide-deck above — reached from
    // Tutor Chat's "Generate Infographic" action, Learning Path's
    // resource tile, or Chapter Reader's Up Next panel, not the
    // top-level sidebar.
    path: '/infographic',
    Component: lazy(() => import('../modules/ai/pages/Infographic')),
    roles: ['student', 'school student'],
  },
  {
    path: '/infographic/:chapterId',
    Component: lazy(() => import('../modules/ai/pages/Infographic')),
    roles: ['student', 'school student'],
  },
  {
    // Route path is /academic-calendar (not /my-calendar, even though the
    // module folder is src/modules/my-calendar/) — this exact path is
    // already registered as this student's sidebar "My Calendar" Feature
    // row (router_link), seeded ahead of this page being built; the folder
    // name and the URL are independent of each other. Self-student-owned
    // calendar per the product spec's explicit scope rule — same
    // roles+modes pairing /self/dashboard and /school/dashboard already use.
    path: '/academic-calendar',
    Component: lazy(() => import('../modules/my-calendar/pages/MyCalendar')),
    roles: ['student', 'school student'],
  },
  {
    path: '/study-planner',
    Component: lazy(() => import('../modules/my-calendar/pages/MyCalendar')),
    roles: ['student', 'school student'],
  },
  {
    path: '/library',
    Component: lazy(() => import('../modules/library/pages/Library')),
    roles: ['student', 'school student'],
  },
  {
    // Same reasoning as /flashcards above — reached from a chapter's own
    // action buttons, no Feature row needed for it to be reachable.
    path: '/read/:chapterId',
    Component: lazy(() => import('../modules/reader/pages/ChapterReader')),
    roles: ['student', 'school student'],
  },
  {
    path: '/mastery-analytics',
    Component: lazy(() => import('../modules/assessment/pages/MasteryAnalytics')),
    roles: ['student', 'school student'],
  },

  // ── Education-1 admin-configured features (Myntiq-Education org) ──────
  // These routes exist to match the Feature rows created in admin >
  // Features (category Education-1, availability "React-Education App").
  // Without a matching route here, the dynamic sidebar menu (built from
  // GET /api/menu - see Sidebar.jsx) renders a link that hits the "*" ->
  // "/" catch-all and silently bounces the user back to their dashboard.
  // Pages are stubs (ComingSoonPage) until their real content is built -
  // swap the Component below when that happens, nothing else changes.
  // roles include 'student' + 'school student' to match today's feature
  // set (all of these are student-facing tools, shared by both onboarding
  // paths) - widen further if/when the backend feature-permissions for
  // these features actually differ by role.
  {
    path: '/dashboard',
    Component: lazy(() => import('../modules/dashboard/pages/EducationDashboard')),
    roles: ['student', 'school student'],
  },
  {
    path: '/my-learning',
    Component: lazy(() => import('../modules/my-learning/pages/MyLearning')),
    roles: ['student', 'school student'],
  },
  {
    path: '/my-learning/learning-path',
    Component: lazy(() => import('../modules/my-learning/pages/LearningPath')),
    roles: ['student', 'school student'],
  },
  {
    path: '/my-learning/subjects',
    Component: lazy(() => import('../modules/my-learning/pages/Subjects')),
    roles: ['student', 'school student'],
  },
  {
    // Sprint 1 task 1 - was missing, blocking Phase 0's paused
    // show_in_menu flag on feature 287 from ever being flipped on safely.
    path: '/my-learning/chapters',
    Component: lazy(() => import('../modules/my-learning/pages/Chapters')),
    roles: ['student', 'school student'],
  },
  {
    path: '/mock-tests',
    Component: lazy(() => import('../modules/mock-tests/pages/MockTests')),
    roles: ['student', 'school student'],
  },
  {
    path: '/mock-tests/history',
    Component: lazy(() => import('../modules/mock-tests/pages/TestHistory')),
    roles: ['student', 'school student'],
  },
  {
    path: '/mock-tests/upcoming',
    Component: lazy(() => import('../modules/mock-tests/pages/UpcomingTests')),
    roles: ['student', 'school student'],
  },
  {
    path: '/sample-papers',
    Component: lazy(() => import('../modules/sample-papers/pages/SamplePapers')),
    roles: ['student', 'school student'],
  },
  {
    path: '/sample-papers/:paperId',
    Component: lazy(() => import('../modules/sample-papers/pages/SamplePaperAttempt')),
    roles: ['student', 'school student'],
  },
  {
    path: '/sample-papers/attempts/:attemptId',
    Component: lazy(() => import('../modules/sample-papers/pages/SamplePaperResult')),
    roles: ['student', 'school student'],
  },
  {
    path: '/notes',
    Component: lazy(() => import('../modules/notes/pages/Notes')),
    roles: ['student', 'school student'],
  },
  {
    path: '/notes/my-notes',
    Component: lazy(() => import('../modules/notes/pages/MyNotes')),
    roles: ['student', 'school student'],
  },
  {
    path: '/progress',
    Component: lazy(() => import('../modules/progress/pages/Progress')),
    roles: ['student', 'school student'],
  },
  {
    // Sidebar's "Settings" entry is Feature 3 (parent, group-only, never
    // navigated to directly — see Sidebar.jsx's renderMenuItem) with one
    // child, Feature 311 "General Settings", whose router_link is exactly
    // /settings/general-settings. /settings itself is included too, only
    // as a defensive fallback in case it's ever reached directly.
    path: '/settings',
    Component: SettingsComponent,
    roles: ['student', 'school student'],
  },
  {
    path: '/settings/general-settings',
    Component: SettingsComponent,
    roles: ['student', 'school student'],
  },
  {
    // Feature 312 "Notifications" — a second real, permission-granted
    // sidebar entry under Settings, distinct from General Settings.
    // Opens the same page directly on the Notifications tab.
    path: '/settings/notifications',
    Component: SettingsComponent,
    roles: ['student', 'school student'],
  },
  {
    path: '/progress/overview',
    Component: lazy(() => import('../modules/progress/pages/ProgressOverview')),
    roles: ['student', 'school student'],
  },
  {
    path: '/progress/subjects',
    Component: lazy(() => import('../modules/progress/pages/SubjectProgress')),
    roles: ['student', 'school student'],
  },
  {
    // Sprint 1 task 2 - feature 295 is show_in_menu=true today with no
    // matching route, so it currently 404s for real students.
    path: '/bookmarks',
    Component: lazy(() => import('../modules/bookmarks/pages/Bookmarks')),
    roles: ['student', 'school student'],
  },
  {
    // Sprint 1 task 2 - feature 296 is show_in_menu=true today with no
    // matching route, so it currently 404s for real students.
    path: '/achievements',
    Component: lazy(() => import('../modules/achievements/pages/Achievements')),
    roles: ['student', 'school student'],
  },
  {
    // Feature 283 "AI Tutor" - router_link confirmed /ai-tutor directly
    // against features.csv (parent of "Tutor Chat", feature 284, at
    // /ai-tutor/chat).
    path: '/ai-tutor',
    Component: lazy(() => import('../modules/ai/pages/AiTutor')),
    roles: ['student', 'school student'],
  },
  {
    path: '/ai-tutor/chat',
    Component: lazy(() => import('../modules/ai/pages/TutorChat')),
    roles: ['student', 'school student'],
  },
  {
    // Feature 306 "AI Study Plan" (parent 283 AI Tutor), router_link
    // confirmed against the DB directly.
    path: '/ai-tutor/study-plan',
    Component: lazy(() => import('../modules/ai/pages/AIStudyPlan')),
    roles: ['student', 'school student'],
  },
  {
    // Feature 307 "AI Sessions" (parent 283 AI Tutor), router_link
    // confirmed against the DB directly.
    path: '/ai-tutor/sessions',
    Component: lazy(() => import('../modules/ai/pages/AISessions')),
    roles: ['student', 'school student'],
  },
];

// Where to send an authenticated user landing on "/" or an unknown role.
//
// A freshly signed-up account has no role yet (backend hardcodes role_id: 4
// / no role on self-registration - see Signup.jsx), so `role` comes back
// falsy until the user completes /education/onboarding/role. Route that
// case there instead of defaulting to a student dashboard, otherwise new
// users silently skip role selection and land on a portal that doesn't
// match what they actually are.
//
// Compared case-insensitively because role_name comes straight from the DB
// (see issueUserTokens in user_service.js) with whatever casing was seeded
// there ("Student", "School Student", etc.) - the route tables below are
// all lowercase, so an exact-case switch would silently miss real roles.
//
// IMPORTANT: `student` and `school student` are the ONLY cases that
// resolve to a student-flavored dashboard. Every other outcome - including
// anything unrecognized - falls through to onboarding rather than guessing
// student. Previously `default` fell through to the same fallback branch
// as `student`, which meant a role_id leaking into this field (see the
// refresh-token bug), a persona this app doesn't have a dashboard for yet,
// or an unmatched case would all silently land the user on the student
// flow even though they never chose - or aren't - a student.
//
// `mode` ('self' | 'school' | null) is the student's learning_mode from
// StudentModeContext — pass it whenever known. A student with mode still
// unknown means one of two things: (a) StudentModeContext genuinely hasn't
// finished its fetch yet — callers (RootRedirect, RoleBasedRoute) already
// gate on isLoading and don't call this function until that resolves — or
// (b) the fetch resolved and came back with no profile at all, meaning
// this student has never completed onboarding. Either way, by the time
// this function is actually called with mode === null, onboarding (not a
// dashboard) is the right answer - onboarding itself is a one-time flow:
// once the student finishes it, their profile (and learning_mode) exists,
// so this branch is never hit again for them on subsequent logins.
export const defaultRouteForRole = (role, mode) => {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : role;
  if (!normalized) return '/education/onboarding/role';

  switch (normalized) {
    case 'student':
      if (mode === 'self') return '/self/dashboard';
      if (mode === 'school') return '/school/dashboard';
      // No profile yet (mode unresolved after loading finished) - role
      // selection already forked this student straight into the Self
      // wizard, so send them back to its first step, not a mode-picker.
      return '/education/onboarding/student/self/class';
    case 'school student':
      if (mode === 'school') return '/school/dashboard';
      if (mode === 'self') return '/self/dashboard'; // defensive - shouldn't happen for this role
      // No profile yet - straight to the School wizard's first step.
      return '/education/onboarding/student/school/search';
    default:
      return '/education/onboarding/role';
  }
};
