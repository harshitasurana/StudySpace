// Static router_link -> feature_id map for every Feature row in the
// "Education-1" category (Myntiq-Education org, category_id 83 in
// features.csv). Built directly from that CSV, not guessed.
//
// GET /feature-permissions/role/:roleId (see FeaturePermissionService)
// returns permissions keyed by feature_id, with NO router_link in the
// payload - so there is no generic way to go from "the path the router is
// about to render" to "the feature_id to check permissions for" without a
// lookup like this one. Education-Admin solves the equivalent problem with
// ROUTE_FEATURE_ALIASES (RBACProvider.jsx) - this is that same idea, sized
// down to an exact map since router_link is already the canonical
// identifier here (no fuzzy feature-name matching needed).
//
// A path that is NOT in this map is treated as unrestricted by
// useStudentRBAC()'s canRoute() - i.e. today's role-only gating
// (RoleBasedRoute's `roles` prop) is the only check that applies. That
// covers every pre-existing route that was never modeled as an admin
// Feature (e.g. /curriculum, /pre-assessment) - Sprint 1 only wires
// permission checks for routes that actually have a Feature row behind
// them.
//
// Keep this in sync with Admin > Features whenever a Feature row here is
// added, renamed, or re-pointed at a different router_link.
export const ROUTE_FEATURE_MAP = {
  '/dashboard': 281, // Dashboard Education (hidden parent grouping)
  '/self/dashboard': 282, // Student Dashboard
  '/ai-tutor': 283, // AI Tutor
  '/ai-tutor/chat': 284, // Tutor Chat
  '/my-learning': 285, // My Learning
  '/my-learning/subjects': 286, // Subjects
  '/my-learning/chapters': 287, // Chapters
  '/my-learning/learning-path': 288, // Learning Path
  '/practice': 289, // Practice
  '/practice/by-topic': 290, // By Topic
  '/practice/by-subject': 291, // By Subject
  '/mock-tests': 292, // Mock Tests
  '/progress': 293, // Progress
  '/notes': 294, // Notes
  '/bookmarks': 295, // Bookmarks
  '/achievements': 296, // Achievements
  '/notes/my-notes': 299, // My Notes
  '/progress/subjects': 301, // Subject Progress
  '/mock-tests/upcoming': 302, // Upcoming Tests
  '/mock-tests/history': 303, // Test History
  '/progress/overview': 304, // Progress-Overview
};

export default ROUTE_FEATURE_MAP;