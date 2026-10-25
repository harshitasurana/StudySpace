import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useStudentMode from '../hooks/useStudentMode';
import useStudentRBAC from '../hooks/useStudentRBAC';
import AccessDenied from '../shared/AccessDenied';
import { defaultRouteForRole } from './routeConfig';
import { ROUTE_FEATURE_MAP } from './routeFeatureMap';

/**
 * Wraps a page element and only renders it if the logged-in user's role
 * is in `roles`, AND (for student routes split by learning mode) the
 * user's mode is in `modes`, AND (for routes backed by an admin-configured
 * Feature - see routeFeatureMap.js) useStudentRBAC().canRoute(path) says
 * this role's real feature_permissions grant it read access. Either prop
 * omitted/empty means "no restriction on that axis".
 *
 * Before Sprint 1 this only checked role - the 88 real feature_permissions
 * rows already configured for the Student role did nothing, because
 * nothing here ever looked at them. See Sprint 1 plan, Phase 1: "Permission
 * checks don't actually run."
 *
 * `modes` only matters for role === 'student' or 'school student' — every
 * other role has no concept of self/school mode, so `modes` is simply
 * ignored for them.
 *
 * While mode is still loading (isLoading === true, mode === null), this
 * renders nothing rather than bouncing the user — bouncing on a null mode
 * would incorrectly redirect a school student away from /school/* for the
 * split second before their profile fetch resolves. Same idea for RBAC:
 * a route with no Feature row behind it never has to wait (canRoute
 * returns true synchronously), so this only blocks rendering for routes
 * that actually need the fetch to have finished.
 *
 * Compared case-insensitively, same reasoning as defaultRouteForRole in
 * routeConfig.js: role_name's DB casing shouldn't decide whether a
 * correctly-chosen role gets treated as "unrecognized" and bounced.
 */
const RoleBasedRoute = ({ path, roles, modes, children }) => {
  const { user } = useAuth();
  const { mode, isLoading: modeLoading } = useStudentMode();
  const { canRoute, getFeatureName, isLoading: rbacLoading } = useStudentRBAC();
  const role = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : user?.role;
  const allowedRoles = roles?.map((r) => r.toLowerCase());

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={defaultRouteForRole(role, mode)} replace />;
  }

  const modeGated = (role === 'student' || role === 'school student') && modes && modes.length > 0;
  if (modeGated) {
    if (mode === null && modeLoading) return null; // wait for mode to resolve
    if (mode && !modes.includes(mode)) {
      return <Navigate to={defaultRouteForRole(role, mode)} replace />;
    }
  }

  // Permission check - only for routes actually backed by an admin
  // Feature row (see routeFeatureMap.js). Every other route (e.g.
  // /curriculum) renders immediately, same as before Sprint 1 - no
  // reason to make them wait on a fetch whose result can't change their
  // outcome.
  if (path && ROUTE_FEATURE_MAP[path]) {
    if (rbacLoading) return null; // wait for feature-permissions/menu fetch
    if (!canRoute(path)) {
      // In-app message, not a silent redirect or a 404 - see Sprint 1 exit
      // criteria.
      return <AccessDenied featureName={getFeatureName(path)} />;
    }
  }

  return children;
};

export default RoleBasedRoute;