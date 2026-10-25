import { apiRequest } from "./axios.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

const extractRows = (data, fallback = []) => {
  if (Array.isArray(data)) return data;
  // Triple-nested: { success, data: { data: [...], total, ... } }
  if (Array.isArray(data?.data?.data)) return data.data.data;
  // Double-nested array
  if (Array.isArray(data?.data)) return data.data;
  // Named arrays
  if (Array.isArray(data?.data?.roles)) return data.data.roles;
  if (Array.isArray(data?.data?.features)) return data.data.features;
  if (Array.isArray(data?.roles)) return data.roles;
  if (Array.isArray(data?.features)) return data.features;
  return fallback;
};

const extractPagination = (data) => {
  // Explicit pagination sub-object
  if (data?.data?.pagination) return data.data.pagination;
  if (data?.pagination) return data.pagination;
  // Flat pagination fields at data.data level: { data: [...], total, limit, page, totalPages }
  const d = data?.data;
  if (d && (d.total !== undefined || d.totalPages !== undefined)) {
    return {
      total: d.total,
      limit: d.limit,
      page: d.page,
      totalPages: d.totalPages,
      offset: d.offset,
    };
  }
  return null;
};

const normalizePermissionName = (raw) => {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  if (!key) return null;
  if (["read", "create", "update", "delete"].includes(key)) return `can_${key}`;
  return key.startsWith("can_") ? key : `can_${key}`;
};

const toPermissionRows = (permissions) => {
  if (Array.isArray(permissions)) {
    return permissions
      .map((entry) => ({
        permission_name: normalizePermissionName(entry?.permission_name || entry),
        permission_display_name: entry?.permission_display_name || null,
        permission_description: entry?.permission_description || null,
        is_enabled: entry?.is_enabled !== false,
      }))
      .filter((entry) => Boolean(entry.permission_name));
  }

  if (permissions && typeof permissions === "object") {
    return Object.entries(permissions)
      .filter(([, value]) => typeof value === "boolean")
      .map(([permissionName, isEnabled]) => ({
        permission_name: normalizePermissionName(permissionName),
        permission_display_name: null,
        permission_description: null,
        is_enabled: isEnabled,
      }))
      .filter((entry) => Boolean(entry.permission_name));
  }

  return [];
};

const sanitizeFeaturePayload = (body = {}) => {
  const payload = { ...body };

  if (Array.isArray(payload.availability_type_ids)) {
    payload.availability_type_ids = payload.availability_type_ids
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id) && id > 0);
  }

  delete payload.feature_availability;
  delete payload.availability_type_id;

  return payload;
};

// ─── ROLES ──────────────────────────────────────────────────────────────────

export const getRoles = async (params = {}) => {
  const res = await apiRequest.get("/roles", { params });
  return {
    rows: extractRows(res.data),
    pagination: extractPagination(res.data),
  };
};

export const getRoleById = async (id) => {
  const res = await apiRequest.get(`/roles/${id}`);
  return res.data?.data || res.data;
};

export const createRole = async (body) => {
  const res = await apiRequest.post("/roles", body);
  return res.data?.data || res.data;
};

export const updateRole = async (id, body) => {
  const res = await apiRequest.put(`/roles/${id}`, body);
  return res.data?.data || res.data;
};

export const deleteRole = async (id) => {
  const res = await apiRequest.delete(`/roles/${id}`);
  return res.data;
};

export const activateRole = async (id) => {
  const res = await apiRequest.patch(`/roles/${id}/activate`);
  return res.data;
};

export const deactivateRole = async (id) => {
  const res = await apiRequest.patch(`/roles/${id}/deactivate`);
  return res.data;
};

export const getRoleCategories = async () => {
  const res = await apiRequest.get("/roles/categories", {
    params: { limit: 200 },
  });
  return extractRows(res.data);
};

// ─── ROLE TEMPLATES ──────────────────────────────────────────────────────────

export const getRoleTemplates = async (params = {}) => {
  const res = await apiRequest.get("/roles/templates/all", { params });
  const data = res.data?.data ?? res.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.templates)) return data.templates;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
};

// ─── ROLE → FEATURE ASSIGNMENTS ─────────────────────────────────────────────

export const getRoleFeatures = async (roleId) => {
  const res = await apiRequest.get(`/roles/${roleId}/features`);
  return extractRows(res.data);
};

export const getAvailableFeaturesForRole = async (roleId) => {
  const res = await apiRequest.get(`/roles/${roleId}/available-features`);
  return extractRows(res.data);
};

export const getAvailabilityTypes = async (params = {}) => {
  const res = await apiRequest.get("/feature-availability-types", { params });
  return extractRows(res.data);
};

export const getAvailabilityTypeById = async (id) => {
  const res = await apiRequest.get(`/feature-availability-types/${id}`);
  return res.data?.data || res.data;
};

export const createAvailabilityType = async (body) => {
  const res = await apiRequest.post("/feature-availability-types", body);
  return res.data?.data || res.data;
};

export const updateAvailabilityType = async (id, body) => {
  const res = await apiRequest.put(`/feature-availability-types/${id}`, body);
  return res.data?.data || res.data;
};

export const deleteAvailabilityType = async (id) => {
  const res = await apiRequest.delete(`/feature-availability-types/${id}`);
  return res.data;
};

export const assignFeatureToRole = async (roleId, featureId) => {
  const res = await apiRequest.post(`/roles/${roleId}/features`, { feature_id: featureId });
  return res.data;
};

export const removeFeatureFromRole = async (roleId, featureId) => {
  const res = await apiRequest.delete(`/roles/${roleId}/features/${featureId}`);
  return res.data;
};

// ─── FEATURE PERMISSIONS (role × feature matrix) ────────────────────────────

export const getPermissionsByRole = async (roleId) => {
  const res = await apiRequest.get(`/feature-permissions/role/${roleId}`);
  return extractRows(res.data);
};

export const getPermissionsByUser = async (userId) => {
  try {
    const res = await apiRequest.get(`/feature-permissions/user/${userId}`);
    return extractRows(res.data);
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error;
    }

    const res = await apiRequest.get("/feature-permissions", {
      params: { user_id: userId },
    });

    return extractRows(res.data).filter((row) => Number(row?.user_id) === Number(userId));
  }
};

export const upsertFeaturePermission = async (roleId, featureId, perms, userId = null) => {
  const permissionRows = toPermissionRows(perms?.permissions ?? perms);
  const updatePayload = {
    permissions: permissionRows,
  };

  const createPayload = {
    feature_id: featureId,
    permissions: permissionRows,
  };

  if (!permissionRows.length) {
    throw new Error("At least one permission row is required");
  }

  const shouldFallbackToCreate = (error) => {
    const status = Number(error?.response?.status || 0);
    const backendMessage = String(
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      ""
    ).toLowerCase();

    if (status === 404) return true;

    // Some backend paths currently surface missing rows as 500.
    return status === 500 && backendMessage.includes("feature permission not found");
  };

  const checkRoleFeaturePermissionExists = async () => {
    if (!roleId) return false;

    try {
      await apiRequest.get(`/feature-permissions/${roleId}/${featureId}`);
      return true;
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      const backendMessage = String(
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        ""
      ).toLowerCase();

      if (status === 404) return false;
      if (status === 500 && backendMessage.includes("feature permission not found")) return false;

      throw error;
    }
  };

  // Try PUT first (update), fall back to POST (create)
  try {
    if (!roleId && userId) {
      const res = await apiRequest.post("/feature-permissions", {
        ...createPayload,
        user_id: userId,
      });
      return res.data;
    }

    const exists = await checkRoleFeaturePermissionExists();

    if (!exists) {
      const res = await apiRequest.post("/feature-permissions", {
        ...createPayload,
        role_id: roleId,
      });
      return res.data;
    }

    const res = await apiRequest.put(
      `/feature-permissions/${roleId}/${featureId}`,
      updatePayload
    );
    return res.data;
  } catch (err) {
    if (shouldFallbackToCreate(err)) {
      const res = await apiRequest.post("/feature-permissions", {
        ...createPayload,
        role_id: roleId,
        user_id: userId,
      });
      return res.data;
    }
    throw err;
  }
};

export const bulkUpdatePermissions = async (permissions) => {
  const res = await apiRequest.put("/feature-permissions/bulk", { permissions });
  return res.data;
};

export const bulkCreatePermissions = async (permissions) => {
  const res = await apiRequest.post("/feature-permissions/bulk", { permissions });
  return res.data;
};

export const deleteFeaturePermission = async (roleId, featureId) => {
  const res = await apiRequest.delete(`/feature-permissions/${roleId}/${featureId}`);
  return res.data;
};

export const getFeaturePermissionModules = async () => {
  const res = await apiRequest.get("/feature-permissions/modules");
  return extractRows(res.data);
};

export const getAllFeaturePermissionNames = async () => {
  const res = await apiRequest.get("/feature-permissions/permission-names");
  return extractRows(res.data);
};

export const cloneFeaturePermissions = async (sourceRoleId, targetRoleId) => {
  const res = await apiRequest.post(`/feature-permissions/clone/${sourceRoleId}/${targetRoleId}`);
  return res.data;
};

export const cloneUserFeaturePermissions = async (sourceUserId, targetUserId) => {
  const res = await apiRequest.post(`/feature-permissions/clone-user/${sourceUserId}/${targetUserId}`);
  return res.data;
};

// ─── FEATURES ────────────────────────────────────────────────────────────────

export const getFeatures = async (params = {}) => {
  const res = await apiRequest.get("/features", { params });
  return {
    rows: extractRows(res.data),
    pagination: extractPagination(res.data),
  };
};

export const getFeatureById = async (id) => {
  const res = await apiRequest.get(`/features/${id}`);
  return res.data?.data || res.data;
};

export const createFeature = async (body) => {
  const res = await apiRequest.post("/features", sanitizeFeaturePayload(body));
  return res.data?.data || res.data;
};

export const updateFeature = async (id, body) => {
  const res = await apiRequest.put(`/features/${id}`, sanitizeFeaturePayload(body));
  return res.data?.data || res.data;
};

export const deleteFeature = async (id) => {
  const res = await apiRequest.delete(`/features/${id}`);
  return res.data;
};

export const activateFeature = async (id, { scope = "org" } = {}) => {
  const res = await apiRequest.patch(`/features/${id}/activate`, { scope });
  return res.data;
};

export const deactivateFeature = async (id, { scope = "org" } = {}) => {
  const res = await apiRequest.patch(`/features/${id}/deactivate`, { scope });
  return res.data;
};

export const getFeatureCategoryDropdown = async () => {
  const res = await apiRequest.get("/features/categories-list");
  return extractRows(res.data);
};
