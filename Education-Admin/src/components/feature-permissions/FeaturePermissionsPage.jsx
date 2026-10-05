import { useEffect, useMemo, useState } from "react";
import {
  bulkCreatePermissions,
  cloneFeaturePermissions,
  cloneUserFeaturePermissions,
  getAllFeaturePermissionNames,
  getFeaturePermissionModules,
  getPermissionsByRole,
  getPermissionsByUser, // Assume this service exists
  getRoles,
  upsertFeaturePermission,
} from "../../services/roleFeatureService.js";
import { getApiErrorMessage } from "../../services/errorMessage.js";
import { FaSlidersH, FaIdBadge, FaTh, FaKey, FaClone, FaCheckDouble, FaThLarge } from "react-icons/fa";
import ToastMessage from "../../shared/component/ToastMessage.jsx";
import "./FeaturePermissionsPage.css";

const STANDARD_LABELS = {
  can_read: "Read",
  can_create: "Create",
  can_update: "Update",
  can_delete: "Delete",
};

const STANDARD_PERMISSION_KEYS = ["can_create", "can_read", "can_update", "can_delete"];

const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";

const normalizePermToBackend = (name) => {
  const raw = String(name || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!raw) return "";
  if (raw.startsWith("can_")) return raw;
  return `can_${raw}`;
};

const extractPermissionKey = (permission) => {
  if (typeof permission === "string") {
    return normalizePermToBackend(permission);
  }

  if (permission && typeof permission === "object") {
    return normalizePermToBackend(
      permission.permission_name || permission.name || permission.permissionKey
    );
  }

  return "";
};

const prettifyPermissionLabel = (permissionKey) => {
  if (STANDARD_LABELS[permissionKey]) return STANDARD_LABELS[permissionKey];
  return permissionKey
    .replace(/^can_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const sortPermissionKeys = (keys) => {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
  const standardKeys = STANDARD_PERMISSION_KEYS.filter((key) => uniqueKeys.includes(key));
  const customKeys = uniqueKeys
    .filter((key) => !STANDARD_PERMISSION_KEYS.includes(key))
    .sort((a, b) => prettifyPermissionLabel(a).localeCompare(prettifyPermissionLabel(b)));
  return [...standardKeys, ...customKeys];
};

const getFeaturePermissionKeys = (module) => {
  const moduleKeys = Array.isArray(module?.permissions)
    ? module.permissions.map((permission) => extractPermissionKey(permission)).filter(Boolean)
    : [];

  return sortPermissionKeys(moduleKeys);
};

const extractPermissionStateFromRow = (row) => {
  const state = {};

  if (row?.permissions && typeof row.permissions === "object" && !Array.isArray(row.permissions)) {
    Object.entries(row.permissions).forEach(([key, value]) => {
      if (typeof value !== "boolean") return;
      const normalized = normalizePermToBackend(key);
      if (!normalized) return;
      state[normalized] = value;
    });
  }

  if (Array.isArray(row?.permissions)) {
    row.permissions.forEach((permission) => {
      if (typeof permission === "string") {
        const key = normalizePermToBackend(permission);
        if (key) state[key] = true;
        return;
      }

      const key = normalizePermToBackend(permission?.permission_name);
      if (!key) return;
      state[key] = permission?.is_enabled !== false;
    });
  }

  Object.entries(row || {}).forEach(([key, value]) => {
    if (!key.startsWith("can_") || typeof value !== "boolean") return;
    state[normalizePermToBackend(key)] = value;
  });

  return state;
};

const FeaturePermissionsPage = () => {
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assignmentMode, setAssignmentMode] = useState("role"); // 'role' or 'user'
  const [cloneRoleId, setCloneRoleId] = useState("");
  const [sourceUserId, setSourceUserId] = useState("");

  const [modules, setModules] = useState([]);
  const [permissionKeys, setPermissionKeys] = useState([]);

  const [baselineMap, setBaselineMap] = useState({});
  const [draftMap, setDraftMap] = useState({});

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 5000);
  };

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const [rolesRes, modulesRes, namesRes] = await Promise.all([
        getRoles({
          page: 1,
          limit: 200,
          is_deleted: false,
        }),
        getFeaturePermissionModules(),
        getAllFeaturePermissionNames(),
      ]);

      const rows = rolesRes?.rows || [];
      setRoles(rows);

      const normalizedModules = (modulesRes || []).map((module) => ({
        ...module,
        feature_id: Number(module.feature_id),
        permissions: Array.from(
          new Set((module.permissions || []).map((permission) => extractPermissionKey(permission)).filter(Boolean))
        ),
      }));

      setModules(normalizedModules);

      const fromModules = normalizedModules.flatMap((module) => module.permissions || []);
      const fromCatalog = (namesRes || []).map((name) => normalizePermToBackend(name));
      const keys = sortPermissionKeys([...STANDARD_PERMISSION_KEYS, ...fromModules, ...fromCatalog]);

      setPermissionKeys(keys);

      if (rows.length > 0) {
        const firstRoleId = String(rows[0].role_id);
        setSelectedRoleId(firstRoleId);
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to load feature-permission catalog."), "error");
    } finally {
      setLoading(false);
    }
  };

  const loadEffectivePermissions = async (id, mode) => {
    if (!id) return;

    setLoading(true);
    try {
      const roleRows = mode === 'role' ? await getPermissionsByRole(Number(id)) : await getPermissionsByUser(Number(id));
      const nextMap = {};

      for (const row of roleRows || []) {
        const featureId = Number(row.feature_id);
        nextMap[featureId] = nextMap[featureId] || {};

        const rowState = extractPermissionStateFromRow(row);
        Object.entries(rowState).forEach(([key, isEnabled]) => {
          nextMap[featureId][key] = Boolean(isEnabled);
        });
      }

      for (const module of modules) {
        const featureId = Number(module.feature_id);
        nextMap[featureId] = nextMap[featureId] || {};
        const featurePermissionKeys = getFeaturePermissionKeys(module);

        for (const permissionKey of featurePermissionKeys) {
          if (nextMap[featureId][permissionKey] === undefined) {
            nextMap[featureId][permissionKey] = false;
          }
        }
      }

      setBaselineMap(nextMap);
      setDraftMap(JSON.parse(JSON.stringify(nextMap)));
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to load permissions for selected role."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    const targetId = assignmentMode === 'role' ? selectedRoleId : selectedUserId;
    if (!targetId || modules.length === 0 || permissionKeys.length === 0) return;
    loadEffectivePermissions(targetId, assignmentMode);
  }, [selectedRoleId, selectedUserId, assignmentMode, modules, permissionKeys.length]);

  const filteredModules = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return modules;

    return modules.filter((module) => {
      const name = String(module.feature_name || "").toLowerCase();
      const cat = String(module.category_name || "").toLowerCase();
      return name.includes(term) || cat.includes(term);
    });
  }, [modules, search]);

  const dirtyFeatureIds = useMemo(() => {
    const dirty = [];
    for (const module of modules) {
      const featureId = Number(module.feature_id);
      const current = draftMap[featureId] || {};
      const base = baselineMap[featureId] || {};
      const featurePermissionKeys = getFeaturePermissionKeys(module);
      const hasChange = featurePermissionKeys.some((key) => Boolean(current[key]) !== Boolean(base[key]));
      if (hasChange) dirty.push(featureId);
    }
    return dirty;
  }, [modules, draftMap, baselineMap]);

  const selectedRole = roles.find((role) => String(role.role_id) === String(selectedRoleId));

  const onTogglePermission = (featureId, permissionKey) => {
    setDraftMap((current) => {
      const clone = { ...current };
      clone[featureId] = { ...(clone[featureId] || {}) };
      clone[featureId][permissionKey] = !Boolean(clone[featureId][permissionKey]);
      return clone;
    });
  };

  const onToggleFeaturePermissions = (featureId, featurePermissionKeys, isEnabled) => {
    setDraftMap((current) => {
      const clone = { ...current };
      clone[featureId] = { ...(clone[featureId] || {}) };

      featurePermissionKeys.forEach((permissionKey) => {
        clone[featureId][permissionKey] = Boolean(isEnabled);
      });

      return clone;
    });
  };

  const allPermissionPairs = useMemo(
    () =>
      modules.flatMap((module) => {
        const featureId = Number(module.feature_id);
        const featurePermissionKeys = getFeaturePermissionKeys(module);
        return featurePermissionKeys.map((permissionKey) => ({ featureId, permissionKey }));
      }),
    [modules]
  );

  const isAllPermissionsSelected =
    allPermissionPairs.length > 0 &&
    allPermissionPairs.every(({ featureId, permissionKey }) => Boolean(draftMap[featureId]?.[permissionKey]));

  const onToggleAllPermissions = (isEnabled) => {
    setDraftMap((current) => {
      const clone = { ...current };

      for (const module of modules) {
        const featureId = Number(module.feature_id);
        const featurePermissionKeys = getFeaturePermissionKeys(module);
        clone[featureId] = { ...(clone[featureId] || {}) };

        featurePermissionKeys.forEach((permissionKey) => {
          clone[featureId][permissionKey] = Boolean(isEnabled);
        });
      }

      return clone;
    });
  };

  const onSave = async () => {
    const targetId = assignmentMode === 'role' ? selectedRoleId : selectedUserId;
    if (!targetId || dirtyFeatureIds.length === 0) {
      showToast("No permission changes to save.", "error");
      return;
    }

    setSaving(true);
    try {
      const permissionPayloads = dirtyFeatureIds.map((featureId) => {
        const module = modules.find((entry) => Number(entry.feature_id) === Number(featureId));
        const featurePermissionKeys = getFeaturePermissionKeys(module);

        const permissionRows = featurePermissionKeys.map((key) => {
          const permissionLabel = prettifyPermissionLabel(key);

          return {
            permission_name: key,
            permission_display_name: permissionLabel,
            permission_description: `${permissionLabel} access`,
            is_enabled: Boolean(draftMap[featureId]?.[key]),
          };
        });

        return {
          role_id: assignmentMode === 'role' ? Number(targetId) : undefined,
          user_id: assignmentMode === 'user' ? Number(targetId) : undefined,
          feature_id: Number(featureId),
          permissions: permissionRows,
        };
      });

      if (assignmentMode === 'role') {
        if (permissionPayloads.length > 0) {
          await bulkCreatePermissions(permissionPayloads);
        }
      } else {
        const requests = permissionPayloads.map((row) =>
          upsertFeaturePermission(
            null,
            row.feature_id,
            { permissions: row.permissions },
            row.user_id
          )
        );

        await Promise.all(requests);
      }

      setBaselineMap(JSON.parse(JSON.stringify(draftMap)));
      showToast(`Saved ${dirtyFeatureIds.length} feature permission set(s) successfully.`);
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to save feature permissions."), "error");
    } finally {
      setSaving(false);
    }
  };

  const onClonePermissions = async () => {
    setCloning(true);
    try {
      if (assignmentMode === "role") {
        if (!cloneRoleId || !selectedRoleId) {
          showToast("Select source and target roles before cloning.", "error");
          return;
        }
        if (String(cloneRoleId) === String(selectedRoleId)) {
          showToast("Source and target roles cannot be same.", "error");
          return;
        }
        await cloneFeaturePermissions(Number(cloneRoleId), Number(selectedRoleId));
        await loadEffectivePermissions(selectedRoleId, "role");
      } else {
        if (!sourceUserId || !selectedUserId) {
          showToast("Enter source and target user IDs before cloning.", "error");
          return;
        }
        await cloneUserFeaturePermissions(Number(sourceUserId), Number(selectedUserId));
        await loadEffectivePermissions(selectedUserId, "user");
      }
      showToast("Permissions cloned successfully.");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to clone permissions."), "error");
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-3 px-md-4 hc-perm-lab">
      <ToastMessage toast={toast} />

      <div className="hc-perm-hero mb-4">
        <div className="position-relative d-flex flex-wrap align-items-start justify-content-between gap-4">
          <div>
            <div className="hc-perm-kicker">Permission Fabric</div>
            <h4 className="mb-2 fw-bold hc-perm-title">
              <FaSlidersH className="me-2" />
              Feature Permissions Matrix
            </h4>
            <p className="mb-0 hc-perm-subtitle">
              Manage role-feature permissions from a high-precision matrix. Toggle standard and custom capabilities, clone from another role, and publish updates in one flow.
            </p>
          </div>
          <div className="d-flex flex-wrap justify-content-md-end gap-2">
            <span className="hc-perm-stat"><FaIdBadge />{roles.length} roles</span>
            <span className="hc-perm-stat"><FaTh />{modules.length} features</span>
            <span className="hc-perm-stat"><FaKey />{permissionKeys.length} permissions</span>
          </div>
        </div>
      </div>

      <div className="card border-0 rounded-4 mb-4 hc-perm-panel">
        <div className="card-body p-3 p-md-4">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-2">
              <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>Assign To</label>
              <select className="form-select rounded-3 hc-perm-select" value={assignmentMode} onChange={(e) => setAssignmentMode(e.target.value)}>
                <option value="role">Role</option>
                <option value="user">User (Override)</option>
              </select>
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>{assignmentMode === 'role' ? 'Target Role' : 'Target User ID'}</label>
              {assignmentMode === 'role' ? (
                <select
                  className="form-select rounded-3 hc-perm-select"
                  value={selectedRoleId}
                  onChange={(event) => setSelectedRoleId(event.target.value)}
                >
                  {roles.map((role) => (
                    <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="number" 
                  className="form-control rounded-3 hc-perm-input" 
                  placeholder="Enter User ID..." 
                  value={selectedUserId} 
                  onChange={(e) => setSelectedUserId(e.target.value)} 
                />
              )}
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                {assignmentMode === 'role' ? 'Clone From Role' : 'Clone From User ID'}
              </label>
              {assignmentMode === 'role' ? (
                <select
                  className="form-select rounded-3 hc-perm-select"
                  value={cloneRoleId}
                  onChange={(event) => setCloneRoleId(event.target.value)}
                >
                  <option value="">Select source role</option>
                  {roles
                    .filter((role) => String(role.role_id) !== String(selectedRoleId))
                    .map((role) => (
                      <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                    ))}
                </select>
              ) : (
                <input 
                  type="number" 
                  className="form-control rounded-3 hc-perm-input" 
                  placeholder="Source User ID..." 
                  value={sourceUserId} 
                  onChange={(e) => setSourceUserId(e.target.value)} 
                />
              )}
            </div>

            <div className="col-12 col-md-4 d-flex gap-2 justify-content-md-end">
              <button
                type="button"
                className="btn rounded-3 hc-perm-clone-btn"
                disabled={cloning || (assignmentMode === 'role' ? (!cloneRoleId || !selectedRoleId) : (!sourceUserId || !selectedUserId))}
                onClick={onClonePermissions}
              >
                {cloning ? <span className="spinner-border spinner-border-sm me-2"></span> : <FaClone className="me-2" />}
                Clone
              </button>
              <button
                type="button"
                className="btn rounded-3 px-4 hc-perm-save-btn"
                disabled={saving || dirtyFeatureIds.length === 0}
                onClick={onSave}
              >
                {saving ? <span className="spinner-border spinner-border-sm me-2"></span> : <FaCheckDouble className="me-2" />}
                Save Changes
              </button>
            </div>
          </div>

          <div className="row g-3 mt-1 align-items-center">
            <div className="col-12 col-md-6">
              <input
                className="form-control rounded-3 hc-perm-input"
                placeholder="Search by feature or category"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="col-12 col-md-6 text-md-end">
              <span className="form-check form-check-inline align-middle me-2 mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="select-all-permissions"
                  checked={isAllPermissionsSelected}
                  disabled={allPermissionPairs.length === 0}
                  onChange={(event) => onToggleAllPermissions(event.target.checked)}
                />
                <label className="form-check-label small" htmlFor="select-all-permissions">
                  All permissions
                </label>
              </span>
              <span className="hc-perm-chip me-2">Role: {selectedRole?.role_name || "—"}</span>
              <span className="hc-perm-chip">Pending: {dirtyFeatureIds.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="hc-perm-matrix-wrap">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color: "#1a709b" }}></div>
            <p className="text-muted mt-2 small mb-0">Loading feature permissions...</p>
          </div>
        ) : filteredModules.length === 0 ? (
          <div className="text-center py-5">
            <FaThLarge className="fs-1 text-muted opacity-50" />
            <p className="text-muted mt-2 mb-0">No features found for this filter.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle hc-perm-matrix">
              <thead>
                <tr>
                  <th className="px-3 py-3">Feature</th>
                  <th className="py-3">Category</th>
                  <th className="py-3">Permissions</th>
                </tr>
              </thead>
              <tbody>
                {filteredModules.map((module) => {
                  const featureId = Number(module.feature_id);
                  const featureDraft = draftMap[featureId] || {};
                  const featurePermissions = getFeaturePermissionKeys(module);
                  const isFeatureFullySelected =
                    featurePermissions.length > 0 &&
                    featurePermissions.every((permissionKey) => Boolean(featureDraft[permissionKey]));

                  return (
                    <tr key={featureId}>
                      <td className="px-3 hc-perm-feature-cell">
                        <div className="hc-perm-feature-name">{module.feature_name}</div>
                        <div className="hc-perm-feature-meta">Feature ID {featureId}</div>
                        {featurePermissions.length > 0 && (
                          <div className="form-check mt-2 mb-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`feature-select-${featureId}`}
                              checked={isFeatureFullySelected}
                              onChange={(event) =>
                                onToggleFeaturePermissions(featureId, featurePermissions, event.target.checked)
                              }
                            />
                            <label className="form-check-label small" htmlFor={`feature-select-${featureId}`}>
                              Select all permissions
                            </label>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="hc-perm-chip">{module.category_name || "Uncategorized"}</span>
                      </td>
                      <td>
                        {featurePermissions.length === 0 ? (
                          <span className="text-muted small">No permissions defined</span>
                        ) : (
                          <table className="table table-borderless mb-0">
                            <tbody>
                              {featurePermissions.map((permissionKey) => (
                                <tr key={`${featureId}-${permissionKey}`}>
                                  <td className="py-1 align-middle" style={{ minWidth: 90 }}>
                                    <span className="small text-nowrap">{prettifyPermissionLabel(permissionKey)}</span>
                                  </td>
                                  <td className="py-1 text-end align-middle">
                                    <button
                                      type="button"
                                      className={`hc-perm-toggle${featureDraft[permissionKey] ? " is-on" : ""}`}
                                      onClick={() => onTogglePermission(featureId, permissionKey)}
                                      title={`${module.feature_name}: ${prettifyPermissionLabel(permissionKey)}`}
                                    >
                                      <span className="visually-hidden">{prettifyPermissionLabel(permissionKey)}</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeaturePermissionsPage;
