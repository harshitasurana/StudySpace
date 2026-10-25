import { checkUserFeaturePermission } from "../feature/feature_permissions_model.js";

const PERMISSION_LEVELS = {
  READ_ALL: "read_all",
  READ_ORG: "read_org",
  READ_ASSIGNED: "read_assigned",
  READ_OWN: "read_own",
  NONE: "none",
};

const resolveDynamicValue = (template, user) => {
  if (typeof template === "string" && template.startsWith("req.user.")) {
    const key = template.replace("req.user.", "");
    return user[key];
  }
  if (typeof template === "function") return template(user);
  return template;
};

const buildRoleFilters = (roleConfig, user) => {
  if (roleConfig.level === PERMISSION_LEVELS.READ_ALL) {
    return {};
  }

  // READ_ORG (org-scoped access) no longer applies — this is a
  // single-tenant app with no organization to scope by. No searchConfig
  // in the codebase declares this level; kept in PERMISSION_LEVELS only
  // so an unrecognized/legacy config fails closed (NONE) below rather
  // than throwing.

  if (roleConfig.level === PERMISSION_LEVELS.READ_ASSIGNED) {
    if (!roleConfig.assignedField) return null;
    const userId = resolveDynamicValue(roleConfig.assignedValue, user);
    if (userId == null) return null;
    return { [roleConfig.assignedField]: userId };
  }

  if (roleConfig.level === PERMISSION_LEVELS.READ_OWN) {
    if (!roleConfig.ownerField) return null;
    const userId = resolveDynamicValue(roleConfig.ownerValue, user);
    if (userId == null) return null;
    return { [roleConfig.ownerField]: userId };
  }

  return null;
};

export const resolveEntityPermission = (user, entityConfig) => {
  if (!user || user.role === "super_admin") {
    return { level: PERMISSION_LEVELS.READ_ALL, filters: {} };
  }

  if (entityConfig.roleAccess) {
    const roleConfig = entityConfig.roleAccess[user.role];
    if (!roleConfig || roleConfig.level === PERMISSION_LEVELS.NONE) {
      return { level: PERMISSION_LEVELS.NONE, filters: {} };
    }
    const filters = buildRoleFilters(roleConfig, user);
    if (!filters) {
      return { level: PERMISSION_LEVELS.NONE, filters: {} };
    }
    return {
      level: roleConfig.level,
      filters,
    };
  }

  // No roleAccess config on this entity, and single-tenant app has no
  // organization to scope by — full access for any authenticated user.
  return { level: PERMISSION_LEVELS.READ_ALL, filters: {} };
};

export { PERMISSION_LEVELS };
