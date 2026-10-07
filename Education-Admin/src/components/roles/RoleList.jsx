import { useEffect, useState, useCallback } from "react";
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  activateRole,
  deactivateRole,
  getRoleCategories,
  getRoleFeatures,
  getPermissionsByRole,
  upsertFeaturePermission,
  getFeatures,
} from "../../services/roleFeatureService.js";
import { getApiErrorMessage } from "../../services/errorMessage.js";
import { useRBAC } from "../../shared/component/RBACProvider.jsx";
import ToastMessage from "../../shared/component/ToastMessage.jsx";
import { FaCheckCircle, FaMinusCircle, FaShieldAlt, FaCheck, FaKey, FaFolderOpen, FaSave, FaTrashAlt, FaPlus, FaSearch, FaTimes, FaPencilAlt, FaChevronLeft, FaChevronRight, FaChevronUp, FaChevronDown, FaPlayCircle, FaPauseCircle } from "react-icons/fa";

const DEFAULT_LIMIT = 10;
const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";
const PERMS = ["can_read", "can_create", "can_update", "can_delete"];
const PERM_LABELS = { can_read: "Read", can_create: "Create", can_update: "Update", can_delete: "Delete" };

const toRolePermissionState = (row) => {
  const state = {
    can_read: false,
    can_create: false,
    can_update: false,
    can_delete: false,
  };

  if (row?.permissions && typeof row.permissions === "object" && !Array.isArray(row.permissions)) {
    Object.entries(row.permissions).forEach(([key, value]) => {
      if (!Object.prototype.hasOwnProperty.call(state, key)) return;
      if (typeof value !== "boolean") return;
      state[key] = value;
    });
  }

  if (Array.isArray(row?.permissions)) {
    row.permissions.forEach((permission) => {
      const key =
        typeof permission === "string"
          ? permission
          : permission?.permission_name;
      if (!key || !Object.prototype.hasOwnProperty.call(state, key)) return;

      const isEnabled =
        typeof permission === "object" && permission !== null
          ? permission.is_enabled !== false
          : true;

      state[key] = isEnabled;
    });
  }

  // Backward compatibility for older boolean payloads.
  PERMS.forEach((permissionKey) => {
    if (typeof row?.[permissionKey] === "boolean") {
      state[permissionKey] = row[permissionKey];
    }
  });

  return state;
};

const getCategoryLabel = (value) => {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    return (
      value.category_name ||
      value.name ||
      value.label ||
      value.title ||
      ""
    );
  }
  return "";
};

// ─── Small shared UI ─────────────────────────────────────────────────────────

const StatusBadge = ({ active }) => (
  <span
    className={`badge rounded-pill px-3 py-2`}
    style={{
      background: active ? "rgba(22,163,74,0.12)" : "rgba(100,116,139,0.14)",
      color: active ? "#16a34a" : "#64748b",
      fontWeight: 600,
      fontSize: "0.78rem",
      border: `1px solid ${active ? "rgba(22,163,74,0.24)" : "rgba(100,116,139,0.24)"}`,
    }}
  >
    {active ? <FaCheckCircle className="me-1" /> : <FaMinusCircle className="me-1" />}
    {active ? "Active" : "Inactive"}
  </span>
);

// ─── Role Form Modal ──────────────────────────────────────────────────────────

const RoleFormModal = ({ role, categories, onSave, onClose, saving }) => {
  const [form, setForm] = useState({
    role_name: role?.role_name || "",
    category_id: role?.category_id || "",
    description: role?.description || "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      category_id: form.category_id ? Number(form.category_id) : undefined,
    });
  };

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-0 pb-0 px-4 pt-4">
            <h5 className="modal-title fw-bold" style={{ color: "#0d3a5c" }}>
              <FaShieldAlt className="me-2" style={{ color: "#1a709b" }} />
              {role ? "Edit Role" : "Create Role"}
            </h5>
            <button className="btn-close" onClick={onClose} disabled={saving}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body px-4 py-3">
              <div className="mb-3">
                <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                  Role Name <span className="text-danger">*</span>
                </label>
                <input
                  className="form-control rounded-3"
                  value={form.role_name}
                  onChange={(e) => set("role_name", e.target.value)}
                  required
                  placeholder="e.g. Hospital Admin"
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                  Category
                </label>
                <select
                  className="form-select rounded-3"
                  value={form.category_id}
                  onChange={(e) => set("category_id", e.target.value)}
                >
                  <option value="">— Select Category —</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                        {getCategoryLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                  Description
                </label>
                <textarea
                  className="form-control rounded-3"
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="modal-footer border-0 px-4 pb-4">
              <button
                type="button"
                className="btn btn-outline-secondary rounded-3"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn text-white rounded-3 px-4"
                style={{ background: BRAND }}
                disabled={saving}
              >
                {saving ? (
                  <span className="spinner-border spinner-border-sm me-2"></span>
                ) : (
                  <FaCheck className="me-2" />
                )}
                {role ? "Save Changes" : "Create Role"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Permissions Matrix Modal ────────────────────────────────────────────────

const PermissionsModal = ({ role, onClose }) => {
  const [allFeatures, setAllFeatures] = useState([]);
  const [permMap, setPermMap] = useState({}); // featureId → { can_read, can_create, can_update, can_delete }
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoadingData(true);
      try {
        const [featRes, permRes] = await Promise.all([
          getFeatures({ limit: 500, is_deleted: false, is_active: true }),
          getPermissionsByRole(role.role_id),
        ]);

        setAllFeatures(featRes.rows || []);

        const map = {};
        (permRes || []).forEach((row) => {
          const fId = row.feature_id || row.feature?.feature_id;
          if (fId) {
            map[fId] = toRolePermissionState(row);
          }
        });
        setPermMap(map);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [role.role_id]);

  const toggle = (featureId, perm) => {
    setPermMap((prev) => ({
      ...prev,
      [featureId]: {
        can_read: false,
        can_create: false,
        can_update: false,
        can_delete: false,
        ...(prev[featureId] || {}),
        [perm]: !(prev[featureId]?.[perm] || false),
      },
    }));
  };

  const toggleAll = (featureId, checked) => {
    setPermMap((prev) => ({
      ...prev,
      [featureId]: {
        can_read: checked,
        can_create: checked,
        can_update: checked,
        can_delete: checked,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const tasks = Object.entries(permMap).map(([fId, perms]) =>
        upsertFeaturePermission(role.role_id, Number(fId), perms)
      );
      await Promise.all(tasks);
      setSaveMsg({ type: "success", text: "Permissions saved successfully." });
    } catch {
      setSaveMsg({ type: "error", text: "Failed to save some permissions." });
    } finally {
      setSaving(false);
    }
  };

  // Group by category
  const grouped = {};
  const filtered = allFeatures.filter(
    (f) =>
      !search ||
      (f.feature_name || "").toLowerCase().includes(search.toLowerCase())
  );
  filtered.forEach((f) => {
    const cat = f.category_name || f.category || "Uncategorised";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  });

  return (
    <div
      className="modal show d-block"
      style={{ background: "rgba(0,0,0,0.55)", zIndex: 1060, overflowY: "auto" }}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          {/* Header */}
          <div
            className="modal-header border-0 rounded-top-4 px-4 py-3"
            style={{ background: BRAND }}
          >
            <div>
              <h5 className="modal-title fw-bold text-white mb-0">
                <FaKey className="me-2" />
                Permissions — {role.role_name}
              </h5>
              <small className="text-white opacity-75">
                Toggle feature-level access for this role
              </small>
            </div>
            <button
              className="btn-close btn-close-white ms-auto"
              onClick={onClose}
            ></button>
          </div>

          {/* Search */}
          <div className="px-4 pt-3 pb-2 border-bottom">
            <input
              className="form-control rounded-3"
              placeholder="Search features..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Body */}
          <div className="modal-body px-4 py-3">
            {loadingData ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary"></div>
              </div>
            ) : (
              Object.entries(grouped).map(([category, features]) => (
                <div key={category} className="mb-4">
                  <div
                    className="d-flex align-items-center gap-2 mb-2 px-2 py-1 rounded-2"
                    style={{ background: "rgba(26,112,155,0.07)" }}
                  >
                    <FaFolderOpen style={{ color: "#1a709b" }} />
                    <span className="fw-bold small text-uppercase" style={{ color: "#0d3a5c", letterSpacing: "0.05em" }}>
                      {category}
                    </span>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th className="fw-semibold" style={{ color: "#475569", width: "35%" }}>Feature</th>
                          {PERMS.map((p) => (
                            <th key={p} className="text-center fw-semibold" style={{ color: "#475569" }}>
                              {PERM_LABELS[p]}
                            </th>
                          ))}
                          <th className="text-center fw-semibold" style={{ color: "#475569" }}>All</th>
                        </tr>
                      </thead>
                      <tbody>
                        {features.map((f) => {
                          const fId = f.feature_id;
                          const fPerms = permMap[fId] || {};
                          const allChecked = PERMS.every((p) => fPerms[p]);
                          return (
                            <tr key={fId}>
                              <td>
                                <span className="fw-medium" style={{ color: "#1e293b" }}>
                                  {f.feature_name}
                                </span>
                                {f.description && (
                                  <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                    {f.description}
                                  </div>
                                )}
                              </td>
                              {PERMS.map((p) => (
                                <td key={p} className="text-center">
                                  <div className="form-check form-check-inline m-0 d-flex justify-content-center">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      checked={!!(fPerms[p])}
                                      onChange={() => toggle(fId, p)}
                                      style={{ cursor: "pointer", width: "1.1em", height: "1.1em" }}
                                    />
                                  </div>
                                </td>
                              ))}
                              <td className="text-center">
                                <div className="form-check form-check-inline m-0 d-flex justify-content-center">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={allChecked}
                                    onChange={(e) => toggleAll(fId, e.target.checked)}
                                    style={{ cursor: "pointer", width: "1.1em", height: "1.1em", accentColor: "#1a709b" }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer border-top px-4 py-3 d-flex align-items-center justify-content-between">
            <div>
              {saveMsg && (
                <span
                  className={`badge rounded-pill px-3 py-2 ${saveMsg.type === "success" ? "bg-success" : "bg-danger"}`}
                >
                  {saveMsg.text}
                </span>
              )}
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary rounded-3" onClick={onClose}>
                Close
              </button>
              <button
                className="btn text-white rounded-3 px-4"
                style={{ background: BRAND }}
                onClick={handleSave}
                disabled={saving || loadingData}
              >
                {saving ? (
                  <span className="spinner-border spinner-border-sm me-2"></span>
                ) : (
                  <FaSave className="me-2" />
                )}
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

const DeleteModal = ({ role, onConfirm, onClose, deleting }) => (
  <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1070 }}>
    <div className="modal-dialog modal-dialog-centered modal-sm">
      <div className="modal-content border-0 rounded-4 shadow-lg">
        <div className="modal-body text-center px-4 py-4">
          <div
            className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle"
            style={{ width: 56, height: 56, background: "rgba(220,38,38,0.1)" }}
          >
            <FaTrashAlt className="fs-4 text-danger" />
          </div>
          <h6 className="fw-bold mb-1" style={{ color: "#0d3a5c" }}>Delete Role?</h6>
          <p className="text-muted small mb-0">
            <strong>{role.role_name}</strong> will be soft-deleted and can be restored later.
          </p>
        </div>
        <div className="modal-footer border-0 pt-0 pb-3 px-4 d-flex gap-2 justify-content-center">
          <button className="btn btn-outline-secondary rounded-3" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button className="btn btn-danger rounded-3" onClick={onConfirm} disabled={deleting}>
            {deleting ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Main RoleList Component ──────────────────────────────────────────────────

const RoleList = () => {
  const { can, loading: rbacLoading } = useRBAC();

  const [roles, setRoles] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sortField, setSortField] = useState("role_name");
  const [sortOrder, setSortOrder] = useState("asc");

  const [showForm, setShowForm] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [permTarget, setPermTarget] = useState(null);

  const [toast, setToast] = useState(null);

  const canCreate = can(["roles", "role"], "create");
  const canUpdate = can(["roles", "role"], "update");
  const canDelete = can(["roles", "role"], "delete");

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, sourceFilter, limit, sortField, sortOrder]);

  const fetchRoles = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = {
        page: p,
        limit,
        search: debouncedSearch || undefined,
        sort: `${sortField}:${sortOrder}`,
      };
      if (sourceFilter) { params.source = sourceFilter; }
      if (statusFilter === "active") { params.is_active = true; params.is_deleted = false; }
      else if (statusFilter === "inactive") { params.is_active = false; }
      else if (statusFilter === "deleted") { params.is_deleted = true; }
      else { params.is_deleted = false; }
      const res = await getRoles(params);
      setRoles(res.rows);
      setPagination(res.pagination);
      setPage(p);
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to load roles."), "error");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, sourceFilter, sortField, sortOrder]);

  useEffect(() => {
    fetchRoles(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, sourceFilter, limit, sortField, sortOrder]);
  useEffect(() => { fetchRoles(page); }, [page]);

  useEffect(() => {
    getRoleCategories().then(setCategories).catch(() => {});
  }, []);

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (editRole) {
        await updateRole(editRole.role_id, formData);
        showToast("Role updated successfully.");
      } else {
        await createRole(formData);
        showToast("Role created successfully.");
      }
      setShowForm(false);
      setEditRole(null);
      fetchRoles(1);
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to save role."), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteRole(deleteTarget.role_id);
      showToast("Role deleted.");
      setDeleteTarget(null);
      fetchRoles(1);
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to delete role."), "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (role) => {
    try {
      if (role.is_active) {
        await deactivateRole(role.role_id);
        showToast(`${role.role_name} deactivated.`);
      } else {
        await activateRole(role.role_id);
        showToast(`${role.role_name} activated.`);
      }
      fetchRoles(page);
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to update status."), "error");
    }
  };

  const totalPages = pagination
    ? pagination.totalPages || Math.ceil((pagination.total || 0) / limit)
    : 1;

  if (rbacLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border" style={{ color: "#1a709b" }}></div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      <ToastMessage toast={toast} />

      {/* Modals */}
      {showForm && (
        <RoleFormModal
          role={editRole}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditRole(null); }}
          saving={saving}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          role={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
      {permTarget && (
        <PermissionsModal
          role={permTarget}
          onClose={() => setPermTarget(null)}
        />
      )}

      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bold mb-1" style={{ color: "#0d3a5c" }}>
            <FaShieldAlt className="me-2" style={{ color: "#1a709b" }} />
            Roles Management
          </h4>
          <p className="text-muted mb-0 small">
            Create and manage roles with fine-grained feature permissions.
          </p>
        </div>
        {canCreate && (
          <button
            className="btn text-white rounded-3 px-4 d-flex align-items-center gap-2"
            style={{ background: BRAND }}
            onClick={() => { setEditRole(null); setShowForm(true); }}
          >
            <FaPlus />
            New Role
          </button>
        )}
      </div>

      {/* Filters */}
      <div
        className="card border-0 rounded-4 mb-4"
        style={{ boxShadow: "0 4px 16px rgba(15,23,42,0.06)", border: "1px solid #e6edf5" }}
      >
        <div className="card-body py-3 px-4">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-5">
              <div className="input-group rounded-3 overflow-hidden" style={{ border: "1.5px solid #e2e8f0" }}>
                <span className="input-group-text bg-white border-0 text-muted">
                  <FaSearch />
                </span>
                <input
                  className="form-control border-0 shadow-none"
                  placeholder="Search roles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="btn btn-link text-muted border-0 px-2" onClick={() => setSearch("")}>
                    <FaTimes />
                  </button>
                )}
              </div>
            </div>
            <div className="col-6 col-md-3">
              <select
                className="form-select rounded-3"
                style={{ border: "1.5px solid #e2e8f0" }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
            <div className="col-6 col-md-2">
              <select
                className="form-select rounded-3"
                style={{ border: "1.5px solid #e2e8f0" }}
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                title="Filter by role type"
              >
                <option value="">All Types</option>
                <option value="custom">Custom</option>
                <option value="template">Template-based</option>
                <option value="system">System</option>
              </select>
            </div>
            <div className="col-6 col-md-2">
              <select
                className="form-select rounded-3"
                style={{ border: "1.5px solid #e2e8f0" }}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={10}>10 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={500}>500 / page</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className="card border-0 rounded-4"
        style={{ boxShadow: "0 4px 24px rgba(15,23,42,0.07)", border: "1px solid #e6edf5" }}
      >
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color: "#1a709b" }}></div>
            <p className="text-muted mt-2 small">Loading roles...</p>
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-5">
            <FaShieldAlt className="fs-1 text-muted opacity-40" />
            <p className="text-muted mt-2">No roles found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th className="px-4 py-3 fw-semibold small" style={{ color: "#64748b" }}>#</th>
                  <th className="py-3 fw-semibold small hc-fam-th-sortable" style={{ color: "#64748b", cursor: "pointer" }} onClick={() => handleSort("role_name")}>
                    Role Name
                    {sortField === "role_name" && (sortOrder === "asc" ? <FaChevronUp className="ms-1" /> : <FaChevronDown className="ms-1" />)}
                  </th>
                  <th className="py-3 fw-semibold small hc-fam-th-sortable" style={{ color: "#64748b", cursor: "pointer" }} onClick={() => handleSort("category_name")}>
                    Category
                    {sortField === "category_name" && (sortOrder === "asc" ? <FaChevronUp className="ms-1" /> : <FaChevronDown className="ms-1" />)}
                  </th>
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Description</th>
                  <th className="py-3 fw-semibold small text-center hc-fam-th-sortable" style={{ color: "#64748b", cursor: "pointer" }} onClick={() => handleSort("is_active")}>
                    Status
                    {sortField === "is_active" && (sortOrder === "asc" ? <FaChevronUp className="ms-1" /> : <FaChevronDown className="ms-1" />)}
                  </th>
                  <th className="py-3 fw-semibold small text-end pe-4" style={{ color: "#64748b" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role, idx) => (
                  <tr
                    key={role.role_id}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                  >
                    <td className="px-4 text-muted small">
                      {(page - 1) * limit + idx + 1}
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                          style={{
                            width: 36,
                            height: 36,
                            background: "rgba(26,112,155,0.1)",
                          }}
                        >
                          <FaShieldAlt style={{ color: "#1a709b", fontSize: "0.9rem" }} />
                        </div>
                        <span className="fw-semibold" style={{ color: "#1e293b" }}>
                          {role.role_name}
                        </span>
                        {role.source && role.source !== "custom" && (
                          <span
                            className="badge rounded-pill"
                            style={{
                              fontSize: "0.62rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              background: role.source === "system" ? "rgba(100,116,139,0.14)" : "rgba(99,102,241,0.12)",
                              color: role.source === "system" ? "#64748b" : "#6366f1",
                            }}
                          >
                            {role.source}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-muted small">
                      {getCategoryLabel(role.category_name) || getCategoryLabel(role.category) || "—"}
                    </td>
                    <td
                      className="text-muted small"
                      style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {role.description || "—"}
                    </td>
                    <td className="text-center">
                      <StatusBadge active={role.is_active !== false} />
                    </td>
                    <td className="text-end pe-4">
                      <div className="d-flex justify-content-end gap-1">
                        {/* Permissions */}
                        <button
                          className="btn btn-sm rounded-3 d-flex align-items-center gap-1"
                          style={{ background: "rgba(26,112,155,0.1)", color: "#1a709b", fontSize: "0.78rem" }}
                          onClick={() => setPermTarget(role)}
                          title="Manage Permissions"
                        >
                          <FaKey />
                          <span className="d-none d-md-inline">Permissions</span>
                        </button>

                        {/* Toggle status */}
                        {canUpdate && (
                          <button
                            className="btn btn-sm rounded-3"
                            style={{
                              background: role.is_active !== false
                                ? "rgba(245,158,11,0.1)"
                                : "rgba(22,163,74,0.1)",
                              color: role.is_active !== false ? "#d97706" : "#16a34a",
                              fontSize: "0.78rem",
                            }}
                            onClick={() => handleToggleStatus(role)}
                            title={role.is_active !== false ? "Deactivate" : "Activate"}
                          >
                            {role.is_active !== false ? <FaPauseCircle /> : <FaPlayCircle />}
                          </button>
                        )}

                        {/* Edit */}
                        {canUpdate && (
                          <button
                            className="btn btn-sm rounded-3"
                            style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1", fontSize: "0.78rem" }}
                            onClick={() => { setEditRole(role); setShowForm(true); }}
                            title="Edit"
                          >
                            <FaPencilAlt />
                          </button>
                        )}

                        {/* Delete */}
                        {canDelete && (
                          <button
                            className="btn btn-sm rounded-3"
                            style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626", fontSize: "0.78rem" }}
                            onClick={() => setDeleteTarget(role)}
                            title="Delete"
                          >
                            <FaTrashAlt />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center px-4 py-3 border-top">
            <small className="text-muted">
              Page {page} of {totalPages}
              {pagination?.total && ` · ${pagination.total} total`}
            </small>
            <div className="d-flex gap-1">
              <button
                className="btn btn-sm rounded-3 border"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <FaChevronLeft />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    className="btn btn-sm rounded-3 border"
                    style={
                      p === page
                        ? { background: BRAND, color: "#fff", border: "none" }
                        : {}
                    }
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                className="btn btn-sm rounded-3 border"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <FaChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleList;
