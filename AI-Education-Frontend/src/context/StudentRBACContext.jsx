import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuthContext } from './AuthContext';
import FeaturePermissionService from '../services/FeaturePermissionService';
import MenuService from '../services/MenuService';
import { ROUTE_FEATURE_MAP } from '../routes/routeFeatureMap';

const StudentRBACContext = createContext(null);

// feature_permissions_model.js's groupPermissions() always prefixes with
// "can_" (see normalizePermissionName there), but callers of `can()` here
// may reasonably pass either form ("read" or "can_read") - normalize both
// ways so this doesn't silently start denying access on a naming mismatch.
const normalizePermission = (raw) =>
  String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^can_/, '');

const buildPermissionIndex = (rows) => {
  const byFeatureId = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const featureId = row?.feature_id;
    if (!featureId) return;
    const permissionSet = new Set(
      (row.permissions || [])
        .filter((p) => p?.is_enabled)
        .map((p) => normalizePermission(p.permission_name))
    );
    byFeatureId.set(featureId, {
      featureId,
      featureName: row.feature?.feature_name || null,
      permissionSet,
    });
  });
  return byFeatureId;
};

/**
 * Sprint 1 (Routing & Permissions) fix for the bug flagged in the plan:
 * the student app previously checked ROLE only (RoleBasedRoute.jsx) and
 * never looked at the real feature_permissions rows an admin configures
 * per role - so turning a permission off in Admin had no effect here.
 *
 * Fetches GET /feature-permissions/role/:roleId (this role's real grants)
 * and GET /api/menu (already role-filtered + show_in_menu-filtered by the
 * backend) exactly once per session, and exposes:
 *   - can(featureId, permission)  - real permission check
 *   - canRoute(path)              - path -> feature_id -> can(..., 'read'),
 *                                    or true for any path with no Feature
 *                                    row behind it (unchanged behavior)
 *   - menu                        - raw GET /api/menu payload, so
 *                                    Sidebar.jsx doesn't need its own
 *                                    duplicate fetch
 *
 * Both endpoints are `authenticate`-only (no admin gate), confirmed in
 * feature_permissions_routes.js / menu_routes.js, so this works for any
 * logged-in role's own role_id - not student-specific infrastructure, just
 * scoped to student-facing routes today via ROUTE_FEATURE_MAP.
 */
export const StudentRBACProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuthContext();
  const roleId = user?.role_id || null;

  const [byFeatureId, setByFeatureId] = useState(new Map());
  const [menu, setMenu] = useState([]);
  // Starts true for the same reason StudentModeContext does - avoids a
  // window where isLoading reads false before the fetch effect has had a
  // chance to run at all, which would make RoleBasedRoute treat "haven't
  // checked yet" as "checked, and denied".
  const [isLoading, setIsLoading] = useState(true);

  const refreshRBAC = useCallback(async () => {
    if (!roleId) {
      setByFeatureId(new Map());
      setMenu([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [permissionRows, menuRows] = await Promise.all([
        FeaturePermissionService.getByRole(roleId).catch(() => []),
        MenuService.getMenu().catch(() => []),
      ]);
      setByFeatureId(buildPermissionIndex(permissionRows));
      setMenu(Array.isArray(menuRows) ? menuRows : []);
    } finally {
      setIsLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    if (isAuthenticated && roleId) {
      refreshRBAC();
    } else {
      // Not authenticated / role_id not resolved yet - nothing to gate on,
      // and isLoading must resolve to false or a consumer gating on it
      // waits forever for a fetch that will never happen.
      setByFeatureId(new Map());
      setMenu([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, roleId, refreshRBAC]);

  const can = useCallback(
    (featureId, permission = 'read') => {
      const feature = byFeatureId.get(featureId);
      if (!feature) return false;
      return feature.permissionSet.has(normalizePermission(permission));
    },
    [byFeatureId]
  );

  const canRoute = useCallback(
    (path) => {
      if (!path) return true;
      const featureId = ROUTE_FEATURE_MAP[path];
      // No Feature row behind this path - unrestricted, same as before
      // Sprint 1 (role-only gating via RoleBasedRoute's `roles` prop).
      if (!featureId) return true;
      return can(featureId, 'read');
    },
    [can]
  );

  const getFeatureName = useCallback(
    (path) => {
      const featureId = ROUTE_FEATURE_MAP[path];
      if (!featureId) return null;
      return byFeatureId.get(featureId)?.featureName || null;
    },
    [byFeatureId]
  );

  const value = {
    isLoading,
    menu,
    can,
    canRoute,
    getFeatureName,
    refreshRBAC,
  };

  return <StudentRBACContext.Provider value={value}>{children}</StudentRBACContext.Provider>;
};

export const useStudentRBACContext = () => {
  const ctx = useContext(StudentRBACContext);
  if (!ctx) throw new Error('useStudentRBACContext must be used within a StudentRBACProvider');
  return ctx;
};

export default StudentRBACContext;