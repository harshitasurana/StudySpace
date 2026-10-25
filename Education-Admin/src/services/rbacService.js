import { apiRequest } from "./axios";

const normalizePath = (path) => {
  if (!path) return null;
  const value = String(path).trim();
  if (!value) return null;
  return value.startsWith("/") ? value : `/${value}`;
};

const extractRouterLink = (item) => {
  if (!item) return null;
  const link = item.routerLink ?? item.router_link;
  if (Array.isArray(link) && link.length > 0) return normalizePath(link[0]);
  if (typeof link === "string") return normalizePath(link);
  return null;
};

const remapLegacyDashboardPath = (path) => {
  if (!path) return path;
  const map = {
    "/dashboard/organizations": "/organizations",
    "/dashboard/roles": "/roles",
    "/dashboard/features": "/features",
    "/dashboard/features/add": "/features/add",
    "/admin/features-permissions": "/feature-permissions",
  };
  return map[path] || path;
};

const normalizePermissionName = (raw) => {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  if (!key) return null;
  return key.startsWith("can_") ? key.replace(/^can_/, "") : key;
};

const normalizeFeatureKey = (raw) => {
  if (!raw) return null;
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const extractRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.features)) return payload.features;
  if (Array.isArray(payload?.data?.features)) return payload.data.features;
  return [];
};

const extractMenuItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.menu)) return payload.menu;
  if (Array.isArray(payload?.data?.menu)) return payload.data.menu;
  return [];
};

const extractTotalPages = (payload) => {
  const candidates = [
    payload?.totalPages,
    payload?.data?.totalPages,
    payload?.pagination?.totalPages,
    payload?.data?.pagination?.totalPages,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
};

const normalizeRoleName = (raw) =>
  String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const resolveRoleName = (admin) => {
  if (!admin || typeof admin !== "object") return null;

  if (typeof admin.role === "string" && admin.role.trim()) {
    return admin.role.trim();
  }

  return (
    admin.role_name ||
    admin.roleName ||
    admin.userRole?.role_name ||
    admin.role?.role_name ||
    null
  );
};

const formatRoleLabel = (roleName) => {
  if (!roleName) return null;
  return String(roleName)
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const extractRoleId = (admin) => {
  const candidates = [
    admin?.role_id,
    admin?.roleId,
    admin?.user_role_id,
    admin?.userRoleId,
    admin?.role?.role_id,
    admin?.role?.roleId,
    admin?.role?.id,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
};

const extractOrganizationIds = (user) => {
  const candidates = [];

  if (Array.isArray(user?.organization_ids)) {
    candidates.push(...user.organization_ids);
  }

  if (Array.isArray(user?.organizationIds)) {
    candidates.push(...user.organizationIds);
  }

  if (Array.isArray(user?.organizations)) {
    user.organizations.forEach((org) => {
      candidates.push(org?.organization_id ?? org?.id);
    });
  }

  return [...new Set(candidates.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))];
};

const isSuperAdminRole = (admin) => {
  if (admin?.is_super_admin === true || admin?.isSuperAdmin === true) return true;

  const roleName = normalizeRoleName(resolveRoleName(admin));
  if (!roleName) return false;

  return (
    roleName === "super_admin" ||
    roleName === "superadmin" ||
    roleName === "super_administrator" ||
    roleName.includes("super_admin")
  );
};

/** Map Backend-Main session shapes (login `user`, verify `user`) to UI/RBAC fields. */
export const normalizeSessionUser = (raw) => {
  if (!raw || typeof raw !== "object") return null;

  const firstName = raw.first_name || raw.firstName || "";
  const lastName = raw.last_name || raw.lastName || "";
  const fullName =
    raw.full_name ||
    raw.fullName ||
    raw.name ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    null;

  const roleName = resolveRoleName(raw);
  const numericRoleId = extractRoleId(raw);
  const organizationIds = extractOrganizationIds(raw);

  return {
    ...raw,
    user_id: raw.user_id ?? raw.userId ?? raw.id ?? null,
    id: raw.id ?? raw.user_id ?? raw.userId ?? null,
    email: raw.email ?? raw.account_email ?? raw.accountEmail ?? null,
    account_email: raw.account_email ?? raw.accountEmail ?? raw.email ?? null,
    username: raw.username ?? null,
    first_name: firstName || raw.first_name || null,
    last_name: lastName || raw.last_name || null,
    full_name: fullName,
    name: fullName || raw.name || null,
    role_name: roleName,
    role_label: formatRoleLabel(roleName),
    role_id: numericRoleId ?? raw.role_id ?? raw.roleId ?? null,
    role:
      raw.role && typeof raw.role === "object"
        ? raw.role
        : roleName
          ? {
              role_id: numericRoleId ?? raw.role_id ?? raw.roleId ?? null,
              role_name: roleName,
            }
          : raw.role ?? null,
    organization_ids: organizationIds,
    // Keep a derived alias for compatibility with older components.
    organization_id: organizationIds[0] ?? null,
  };
};

const isSessionCandidate = (candidate) =>
  Boolean(
    candidate &&
      typeof candidate === "object" &&
      (candidate.role_id ||
        candidate.roleId ||
        candidate.role ||
        candidate.email ||
        candidate.account_email ||
        candidate.username ||
        candidate.id ||
        candidate.user_id)
  );

export const resolveSessionAdmin = (payload) => {
  if (!payload || typeof payload !== "object") return null;

  const candidate =
    payload.admin ??
    payload.user ??
    payload.data?.admin ??
    payload.data?.user ??
    null;

  if (!isSessionCandidate(candidate)) return null;

  return normalizeSessionUser(candidate);
};

const enrichSessionRoleFromApi = async (admin) => {
  const normalized = normalizeSessionUser(admin) || admin;
  const roleId = extractRoleId(normalized);
  if (!roleId || resolveRoleName(normalized)) return normalized;

  try {
    const response = await apiRequest.get(`/roles/${roleId}`);
    const role = response.data?.data ?? response.data?.role ?? response.data;
    if (!role?.role_name) return normalized;

    return normalizeSessionUser({
      ...normalized,
      role_id: role.role_id ?? roleId,
      role_name: role.role_name,
      role,
    });
  } catch {
    return normalized;
  }
};

const collectPermissionSet = (row) => {
  const permissionSet = new Set();
  const permissionObject = row?.permissions && !Array.isArray(row.permissions) ? row.permissions : null;

  if (row?.can_read) permissionSet.add("read");
  if (row?.can_create) permissionSet.add("create");
  if (row?.can_update) permissionSet.add("update");
  if (row?.can_delete) permissionSet.add("delete");

  // Support nested object shape: permissions: { can_read, can_create, ... }
  if (permissionObject) {
    if (permissionObject.can_read) permissionSet.add("read");
    if (permissionObject.can_create) permissionSet.add("create");
    if (permissionObject.can_update) permissionSet.add("update");
    if (permissionObject.can_delete) permissionSet.add("delete");

    // Capture custom keys such as can_approve: true
    Object.entries(permissionObject).forEach(([key, value]) => {
      if (!value) return;
      const normalized = normalizePermissionName(key);
      if (normalized) permissionSet.add(normalized);
    });
  }

  if (Array.isArray(row?.permissions)) {
    row.permissions.forEach((entry) => {
      if (typeof entry === "string") {
        const key = normalizePermissionName(entry);
        if (key) permissionSet.add(key);
        return;
      }

      if (entry?.permission_name) {
        if (entry?.is_enabled !== false) {
          const key = normalizePermissionName(entry.permission_name);
          if (key) permissionSet.add(key);
        }
        return;
      }

      if (entry && typeof entry === "object") {
        Object.entries(entry).forEach(([key, value]) => {
          if (typeof value !== "boolean") return;
          if (!value) return;
          const normalized = normalizePermissionName(key);
          if (normalized) permissionSet.add(normalized);
        });
      }
    });
  }

  if (Array.isArray(row?.custom_permissions)) {
    row.custom_permissions.forEach((entry) => {
      if (typeof entry === "string") {
        const key = normalizePermissionName(entry);
        if (key) permissionSet.add(key);
        return;
      }
      if (entry?.permission_name && (entry?.is_enabled ?? true)) {
        const key = normalizePermissionName(entry.permission_name);
        if (key) permissionSet.add(key);
      }
    });
  }

  if (row?.permission_name && (row?.is_enabled ?? true)) {
    const key = normalizePermissionName(row.permission_name);
    if (key) permissionSet.add(key);
  }

  // Alternate custom permission payload shape support
  if (Array.isArray(row?.permissions?.custom)) {
    row.permissions.custom.forEach((entry) => {
      if (typeof entry === "string") {
        const key = normalizePermissionName(entry);
        if (key) permissionSet.add(key);
        return;
      }
      if (entry?.permission_name && (entry?.is_enabled ?? true)) {
        const key = normalizePermissionName(entry.permission_name);
        if (key) permissionSet.add(key);
      }
    });
  }

  return permissionSet;
};

const toFeatureRecord = (row = {}) => {
  const featureId = row.feature_id || row.id || row.feature?.feature_id || row.feature?.id || null;
  const featureName =
    row.feature_name ||
    row.name ||
    row.feature?.feature_name ||
    row.feature?.name ||
    null;

  const routerLink = row.router_link || row.feature?.router_link || null;
  const menuLabel = row.menu_label || row.feature?.menu_label || featureName;
  const menuIcon = row.menu_icon || row.feature?.menu_icon || null;
  const showInMenu = Boolean(row.show_in_menu ?? row.feature?.show_in_menu ?? false);
  const menuOrder = Number(row.menu_order ?? row.feature?.menu_order ?? 0);

  return {
    featureId,
    featureName,
    featureKey: normalizeFeatureKey(featureName),
    routerLink,
    menuLabel,
    menuIcon,
    showInMenu,
    menuOrder,
    permissionSet: collectPermissionSet(row),
  };
};

const mergeFeatureMetadata = (base, incoming) => {
  if (!base) return incoming;

  return {
    ...base,
    featureName: base.featureName || incoming.featureName,
    featureKey: base.featureKey || incoming.featureKey,
    routerLink: base.routerLink || incoming.routerLink,
    menuLabel: base.menuLabel || incoming.menuLabel,
    menuIcon: base.menuIcon || incoming.menuIcon,
    showInMenu: base.showInMenu || incoming.showInMenu,
    menuOrder: base.menuOrder || incoming.menuOrder,
    permissionSet: new Set([...(base.permissionSet || []), ...(incoming.permissionSet || [])]),
  };
};

export const fetchRoleFeatures = async (roleId) => {
  if (!roleId) return [];
  const response = await apiRequest.get(`/feature-permissions/role/${roleId}`);
  return extractRows(response.data);
};

export const fetchUserFeaturePermissions = async (userId) => {
  if (!userId) return [];

  try {
    const response = await apiRequest.get(`/feature-permissions/user/${userId}`);
    return extractRows(response.data);
  } catch (error) {
    if (error?.response?.status !== 404) throw error;
    return [];
  }
};

export const fetchFeatureCatalog = async () => {
  const limit = 100;
  let page = 1;
  let totalPages = 1;
  const rows = [];

  while (page <= totalPages) {
    const response = await apiRequest.get("/features", {
      params: { page, limit, is_deleted: false },
    });

    const currentRows = extractRows(response.data);
    rows.push(...currentRows);

    const detectedTotalPages = extractTotalPages(response.data);
    if (detectedTotalPages) {
      totalPages = detectedTotalPages;
    } else {
      totalPages = currentRows.length < limit ? page : page + 1;
    }

    page += 1;

    if (page > 100) break;
  }

  return rows;
};

export const fetchMenuTree = async () => {
  const response = await apiRequest.get("/menu");
  return extractMenuItems(response.data);
};

// Detect i18n translation keys stored in menu_label (e.g. "menu.dashboard", "menu.adminDashboard")
const isI18nKey = (label) => typeof label === "string" && /^[a-z]+\.[a-zA-Z]/.test(label);

// Convert i18n key or camelCase string to human-readable label
const humanizeLabel = (raw, featureName) => {
  if (!isI18nKey(raw)) return raw;
  if (featureName) return featureName;
  const part = raw.split(".").pop() || raw;
  return part
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
};

// Map PrimeNG pi-* icons to Bootstrap/FA equivalents used in this project
const ICON_MAP = {
  "pi pi-th-large": "fas fa-tachometer-alt",
  "pi pi-home": "fas fa-tachometer-alt",
  "pi pi-cog": "fas fa-cog",
  "pi pi-user": "fas fa-user",
  "pi pi-users": "fas fa-users",
  "pi pi-user-edit": "fas fa-user-md",
  "pi pi-calendar": "fas fa-calendar-check",
  "pi pi-calendar-plus": "fas fa-calendar-check",
  "pi pi-heart": "fas fa-heartbeat",
  "pi pi-list": "fas fa-list",
  "pi pi-plus": "fas fa-plus",
  "pi pi-plus-circle": "fas fa-plus-circle",
  "pi pi-building": "bi bi-building",
  "pi pi-hospital": "bi bi-hospital",
  "pi pi-chart-bar": "fas fa-chart-bar",
  "pi pi-chart-line": "fas fa-chart-line",
  "pi pi-file": "fas fa-file",
  "pi pi-folder": "fas fa-folder",
  "pi pi-bell": "fas fa-bell",
  "pi pi-envelope": "fas fa-envelope",
  "pi pi-search": "fas fa-search",
  "pi pi-shield": "fas fa-shield-alt",
  "pi pi-lock": "fas fa-lock",
  "pi pi-key": "fas fa-key",
  "pi pi-truck": "fas fa-ambulance",
  "pi pi-box": "fas fa-boxes",
  "pi pi-cart-plus": "fas fa-shopping-cart",
  "pi pi-dollar": "fas fa-dollar-sign",
  "pi pi-credit-card": "fas fa-credit-card",
  "pi pi-clock": "fas fa-clock",
  "pi pi-star": "fas fa-star",
  "pi pi-comment": "fas fa-comment",
  "pi pi-comments": "fas fa-comments",
  "pi pi-circle": "bi bi-circle",
};

const resolveIcon = (rawIcon) => {
  if (!rawIcon) return "bi bi-circle";
  if (ICON_MAP[rawIcon]) return ICON_MAP[rawIcon];
  // If it's already a Bootstrap or FA class, pass through unchanged
  if (rawIcon.startsWith("bi ") || rawIcon.startsWith("fas ") || rawIcon.startsWith("far ") || rawIcon.startsWith("fab ")) return rawIcon;
  // Any remaining pi-* icons get a default
  if (rawIcon.startsWith("pi ")) return "bi bi-circle-fill";
  return rawIcon;
};

const mapMenuItem = (item = {}) => {
  const children = Array.isArray(item.items) ? item.items.map(mapMenuItem) : [];
  const routePath = remapLegacyDashboardPath(extractRouterLink(item));
  const rawLabel = item.label || item.feature || "Untitled";

  return {
    label: humanizeLabel(rawLabel, item.feature),
    icon: resolveIcon(item.icon),
    routePath,
    feature: item.feature || null,
    featureId: item.feature_id || null,
    menuOrder: Number(item.menu_order ?? 0),
    category: item.category || null,
    items: children,
  };
};

const collectMenuPaths = (items = [], result = new Set()) => {
  items.forEach((item) => {
    if (item.routePath) result.add(item.routePath);
    if (Array.isArray(item.items) && item.items.length > 0) {
      collectMenuPaths(item.items, result);
    }
  });
  return result;
};

export const bootstrapRBAC = async (admin) => {
  const sessionUser = await enrichSessionRoleFromApi(normalizeSessionUser(admin) || admin);
  const roleId = extractRoleId(sessionUser);
  const userId = Number(sessionUser?.user_id ?? sessionUser?.id ?? 0) || null;
  if (!roleId) {
    return {
      sessionUser,
      roleId: null,
      generatedAt: Date.now(),
      isSuperAdmin: isSuperAdminRole(sessionUser),
      features: [],
      featuresByKey: {},
      menu: [],
      allowedRoutePaths: [],
    };
  }

  const [roleFeatureRows, userFeatureRows, catalogRows, menuRows] = await Promise.all([
    fetchRoleFeatures(roleId),
    fetchUserFeaturePermissions(userId).catch(() => []),
    fetchFeatureCatalog().catch(() => []),
    fetchMenuTree().catch(() => []),
  ]);

  const menuItems = menuRows.map(mapMenuItem);
  const allowedRoutePaths = [...collectMenuPaths(menuItems)];

  const byId = new Map();
  const byKey = new Map();

  roleFeatureRows.forEach((row) => {
    const parsed = toFeatureRecord(row);
    const idKey = parsed.featureId || `name:${parsed.featureKey || "unknown"}`;
    const merged = mergeFeatureMetadata(byId.get(idKey), parsed);
    byId.set(idKey, merged);
  });

  catalogRows.forEach((row) => {
    const parsed = toFeatureRecord(row);
    const idKey = parsed.featureId || `name:${parsed.featureKey || "unknown"}`;
    const merged = mergeFeatureMetadata(byId.get(idKey), parsed);
    byId.set(idKey, merged);
  });

  userFeatureRows.forEach((row) => {
    const parsed = toFeatureRecord(row);
    const idKey = parsed.featureId || `name:${parsed.featureKey || "unknown"}`;
    const current = byId.get(idKey);

    if (!current) {
      byId.set(idKey, parsed);
      return;
    }

    // User-level rows override role-level permission set for the same feature.
    byId.set(idKey, {
      ...current,
      ...parsed,
      permissionSet: parsed.permissionSet,
    });
  });

  [...byId.values()].forEach((feature) => {
    if (!feature.featureKey) return;
    byKey.set(feature.featureKey, feature);
  });

  return {
    sessionUser,
    roleId,
    generatedAt: Date.now(),
    isSuperAdmin: isSuperAdminRole(sessionUser) || Number(roleId) === 1,
    features: [...byId.values()].map((feature) => ({
      ...feature,
      permissions: [...feature.permissionSet],
    })),
    featuresByKey: Object.fromEntries(
      [...byKey.entries()].map(([key, feature]) => [
        key,
        { ...feature, permissions: [...feature.permissionSet] },
      ])
    ),
    menu: menuItems,
    allowedRoutePaths,
  };
};

export { normalizeFeatureKey, normalizePermissionName };