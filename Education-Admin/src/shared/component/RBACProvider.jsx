import { createContext, useContext, useMemo } from "react";
import { normalizeFeatureKey, normalizePermissionName } from "../../services/rbacService";

const RBACContext = createContext({
  loading: true,
  ready: false,
  roleId: null,
  featuresByKey: {},
  menu: [],
  allowedRoutePaths: [],
  can: () => false,
  canAny: () => false,
  canRoute: () => false,
});

const ROUTE_FEATURE_ALIASES = {
  "/dashboard/doctors": [
    "doctors",
    "doctor",
    "doctor_list",
    "manage_doctor",
    "add_doctor",
  ],
  "/dashboard/appointments": [
    "appointments",
    "appointment",
    "all_appointments",
    "calendar_view",
    "appointment_request",
  ],
  "/dashboard/users": [
    "users",
    "user",
    "admin_roles",
    "roles_permissions",
  ],
  "/admin/users": [
    "users",
    "user",
    "admin_roles",
    "roles_permissions",
  ],
  "/roles": [
    "roles",
    "role",
    "admin_roles",
    "roles_permissions",
    "manage_roles",
    "role_management",
  ],
  "/features": [
    "features",
    "feature",
    "manage_features",
    "feature_management",
    "system_features",
  ],
  "/admin/features": [
    "features",
    "feature",
    "manage_features",
    "feature_management",
    "system_features",
  ],
  "/features/add": [
    "add_feature",
    "features",
    "feature",
    "feature_management",
    "system_features",
  ],
  "/admin/features/add": [
    "add_feature",
    "features",
    "feature",
    "feature_management",
    "system_features",
  ],
  "/feature-permissions": [
    "feature_permissions",
    "features_permissions",
    "permissions",
    "feature_management",
    "admin",
  ],
  "/admin/feature-permissions": [
    "feature_permissions",
    "features_permissions",
    "permissions",
    "feature_management",
    "admin",
  ],
  "/menu-ordering": [
    "menu",
    "menus",
    "menu_order",
    "menu_ordering",
    "menu_management",
    "manage_menu",
    "menu_builder",
  ],
  "/admin/menu-ordering": [
    "menu",
    "menus",
    "menu_order",
    "menu_ordering",
    "menu_management",
    "manage_menu",
    "menu_builder",
  ],
  "/admin/feature-availability-types": [
    "feature_availability",
    "feature_availability_types",
    "features",
    "feature",
  ],
};

const findFeature = (featuresByKey, alias) => {
  const key = normalizeFeatureKey(alias);
  if (!key) return null;

  if (featuresByKey[key]) return featuresByKey[key];

  // Fuzzy fallback for inconsistent backend naming.
  const matchedKey = Object.keys(featuresByKey).find(
    (featureKey) => featureKey.includes(key) || key.includes(featureKey)
  );

  return matchedKey ? featuresByKey[matchedKey] : null;
};

export const RBACProvider = ({ children, rbac, onRefreshRBAC }) => {
  const value = useMemo(() => {
    const featuresByKey = rbac?.featuresByKey || {};
    const menu = Array.isArray(rbac?.menu) ? rbac.menu : [];
    const allowedRoutePaths = Array.isArray(rbac?.allowedRoutePaths) ? rbac.allowedRoutePaths : [];
    const isSuperAdmin = Boolean(rbac?.isSuperAdmin);

    const can = (featureAlias, permission = "read") => {
      if (isSuperAdmin) return true;

      const permissionKey = normalizePermissionName(permission);
      if (!permissionKey) return false;

      const aliases = Array.isArray(featureAlias) ? featureAlias : [featureAlias];
      return aliases.some((alias) => {
        const feature = findFeature(featuresByKey, alias);
        if (!feature) return false;
        return (feature.permissions || []).includes(permissionKey);
      });
    };

    const canAny = (checks = []) => {
      if (isSuperAdmin) return true;
      return checks.some((check) => can(check.feature, check.permission));
    };

    const canRoute = (path) => {
      if (isSuperAdmin) return true;
      if (!path || path === "/dashboard") return true;

      if (allowedRoutePaths.includes(path)) return true;

      const aliases = ROUTE_FEATURE_ALIASES[path];
      if (!aliases) return false;
      return can(aliases, "read");
    };

    return {
      loading: Boolean(rbac?.loading),
      ready: Boolean(rbac?.ready),
      roleId: rbac?.roleId || null,
      isSuperAdmin,
      generatedAt: rbac?.generatedAt || null,
      featuresByKey,
      features: rbac?.features || [],
      menu,
      allowedRoutePaths,
      can,
      canAny,
      canRoute,
      refreshRBAC: onRefreshRBAC || (() => {}),
    };
  }, [rbac, onRefreshRBAC]);

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
};

export const useRBAC = () => useContext(RBACContext);

export { ROUTE_FEATURE_ALIASES };