import { useEffect, useState, useCallback, useRef } from "react";
import {
  getFeatures,
  createFeature,
  updateFeature,
  deleteFeature,
  getFeatureById,
  activateFeature,
  deactivateFeature,
  getFeatureCategoryDropdown,
  getAvailabilityTypes,
} from "../../services/roleFeatureService.js";
import { getApiErrorMessage } from "../../services/errorMessage.js";
import { useRBAC } from "../../shared/component/RBACProvider.jsx";
import { FEATURES_CHANGED_EVENT } from "../../shared/hooks/useRealtimeRBAC.js";
import ToastMessage from "../../shared/component/ToastMessage.jsx";
import IconRenderer from "../../shared/component/IconRenderer.jsx";
import "./FeatureList.css";
import { FaPuzzlePiece, FaExclamationTriangle, FaBars, FaCircle, FaCheck, FaTrashAlt, FaMicrochip, FaLayerGroup, FaCheckCircle, FaEye, FaPlus, FaSearch, FaTimes, FaThLarge, FaTable, FaPencilAlt, FaChevronLeft, FaChevronRight, FaChevronUp, FaChevronDown, FaMinusCircle, FaPauseCircle, FaPlayCircle, FaEye as FaEyeSolid } from "react-icons/fa";

const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";

const StatusBadge = ({ active }) => (
  <span
    className="badge rounded-pill px-3 py-2"
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

// ─── Feature Form Modal ────────────────────────────────────────────────────────

const FeatureFormModal = ({
  feature,
  categories,
  featureOptions,
  availabilityTypes,
  onSave,
  onClose,
  saving,
  errorMessage,
  onClearError,
}) => {
  const [form, setForm] = useState({
    feature_name: feature?.feature_name || "",
    description: feature?.description || "",
    category_id: feature?.category_id || "",
    parent_feature_id: feature?.parent_feature_id || "",
    availability_type_ids: Array.isArray(feature?.availability_types)
      ? feature.availability_types.map((t) => t.availability_type_id)
      : (feature?.availability_type_id ? [feature.availability_type_id] : []),
    menu_label: feature?.menu_label || "",
    menu_icon: feature?.menu_icon || "",
    router_link: feature?.router_link || "",
    menu_order: feature?.menu_order ?? "",
    show_in_menu: feature?.show_in_menu ?? false,
    is_active: feature?.is_active ?? true,
    permissions_text: Array.isArray(feature?.permissions)
      ? feature.permissions.join(", ")
      : (feature?.permissions || ""),
  });

  const set = (k, v) => {
    if (errorMessage && onClearError) onClearError();
    setForm((f) => ({ ...f, [k]: v }));
  };

  const toggleAvailabilityType = (id) => {
    if (errorMessage && onClearError) onClearError();
    setForm((current) => {
      const ids = current.availability_type_ids.includes(id)
        ? current.availability_type_ids.filter((i) => i !== id)
        : [...current.availability_type_ids, id];
      return { ...current, availability_type_ids: ids };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { permissions_text, ...rest } = form;
    onSave({
      ...rest,
      category_id: form.category_id ? Number(form.category_id) : null,
      parent_feature_id: form.parent_feature_id ? Number(form.parent_feature_id) : null,
      availability_type_ids: form.availability_type_ids,
      menu_order: form.menu_order !== "" ? Number(form.menu_order) : undefined,
      permissions: String(permissions_text || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    });
  };

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div
            className="modal-header border-0 rounded-top-4 px-4 py-3"
            style={{ background: BRAND }}
          >
            <div>
              <h5 className="modal-title fw-bold text-white mb-0">
                <FaPuzzlePiece className="me-2" />
                {feature ? "Edit Feature" : "Create Feature"}
              </h5>
              <small className="text-white opacity-75">Define a system feature and its menu settings</small>
            </div>
            <button className="btn-close btn-close-white ms-auto" onClick={onClose} disabled={saving}></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body px-4 py-3">
              {errorMessage ? (
                <div className="alert alert-danger border-0 rounded-3 py-2 px-3 mb-3" role="alert">
                  <div className="d-flex align-items-start gap-2">
                    <FaExclamationTriangle className="mt-1" />
                    <div className="small fw-semibold">{errorMessage}</div>
                  </div>
                </div>
              ) : null}

              <div className="row g-3">
                {/* Feature Name */}
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Feature Name <span className="text-danger">*</span>
                  </label>
                  <input
                    className="form-control rounded-3"
                    value={form.feature_name}
                    onChange={(e) => set("feature_name", e.target.value)}
                    required
                    placeholder="e.g. Manage Doctors"
                  />
                </div>

                {/* Category */}
                <div className="col-12 col-md-6">
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
                      <option key={c.category_id || c.id} value={c.category_id || c.id}>
                        {c.name || c.category_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Parent Feature */}
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Parent Feature
                  </label>
                  <select
                    className="form-select rounded-3"
                    value={form.parent_feature_id}
                    onChange={(e) => set("parent_feature_id", e.target.value)}
                  >
                    <option value="">— Root Level —</option>
                    {(featureOptions || [])
                      .filter((item) => Number(item.feature_id) !== Number(feature?.feature_id))
                      .map((item) => (
                        <option key={item.feature_id} value={item.feature_id}>
                          {item.feature_name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Description */}
                <div className="col-12">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Description
                  </label>
                  <textarea
                    className="form-control rounded-3"
                    rows={2}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="Optional description"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Availability <span className="text-danger">*</span>
                  </label>
                  <div className="border rounded-3 p-3" style={{ maxHeight: 200, overflowY: "auto", background: "#fff" }}>
                    {(availabilityTypes || []).map((type) => (
                      <label key={type.availability_type_id} className="d-flex align-items-center gap-2 mb-2" style={{ cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          className="form-check-input mt-0"
                          checked={form.availability_type_ids.includes(type.availability_type_id)}
                          onChange={() => toggleAvailabilityType(type.availability_type_id)}
                        />
                        <span className="small">{type.name}</span>
                      </label>
                    ))}
                    {(!availabilityTypes || availabilityTypes.length === 0) && (
                      <span className="text-muted small">No availability types configured</span>
                    )}
                  </div>
                </div>

                {/* Permissions */}
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Permissions
                    <span className="text-muted fw-normal ms-1 small">(comma separated)</span>
                  </label>
                  <input
                    className="form-control rounded-3"
                    value={form.permissions_text}
                    onChange={(e) => set("permissions_text", e.target.value)}
                    placeholder="CREATE, READ, UPDATE, DELETE"
                  />
                </div>

                {/* Divider */}
                <div className="col-12">
                  <div
                    className="d-flex align-items-center gap-2 py-1 px-2 rounded-2"
                    style={{ background: "rgba(26,112,155,0.07)" }}
                  >
                    <FaBars style={{ color: "#1a709b" }} />
                    <span className="fw-semibold small text-uppercase" style={{ color: "#0d3a5c", letterSpacing: "0.04em" }}>
                      Menu Settings
                    </span>
                  </div>
                </div>

                {/* Menu Label */}
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Menu Label
                  </label>
                  <input
                    className="form-control rounded-3"
                    value={form.menu_label}
                    onChange={(e) => set("menu_label", e.target.value)}
                    placeholder="e.g. Doctor List"
                  />
                </div>

                {/* Menu Icon */}
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Menu Icon
                    <span className="text-muted fw-normal ms-1 small">(CSS class or react-icons)</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text rounded-start-3 border-end-0 bg-white">
                      {form.menu_icon ? (
                        <IconRenderer icon={form.menu_icon} style={{ color: "#1a709b" }} />
                      ) : (
                        <FaCircle className="text-muted" />
                      )}
                    </span>
                    <input
                      className="form-control rounded-end-3 border-start-0"
                      value={form.menu_icon}
                      onChange={(e) => set("menu_icon", e.target.value)}
                      placeholder="fas fa-user-md or fa6/FaDiceD6"
                    />
                  </div>
                </div>

                {/* Router Link */}
                <div className="col-12 col-md-8">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Router Link
                  </label>
                  <input
                    className="form-control rounded-3"
                    value={form.router_link}
                    onChange={(e) => set("router_link", e.target.value)}
                    placeholder="/dashboard/doctors"
                  />
                </div>

                {/* Menu Order */}
                <div className="col-6 col-md-2">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Order
                  </label>
                  <input
                    type="number"
                    className="form-control rounded-3"
                    value={form.menu_order}
                    onChange={(e) => set("menu_order", e.target.value)}
                    min={0}
                    placeholder="0"
                  />
                </div>

                {/* Toggles */}
                <div className="col-6 col-md-2 d-flex flex-column justify-content-end gap-2 pb-1">
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="showInMenu"
                      checked={form.show_in_menu}
                      onChange={(e) => set("show_in_menu", e.target.checked)}
                    />
                    <label className="form-check-label small fw-semibold" htmlFor="showInMenu" style={{ color: "#0d3a5c" }}>
                      Show in Menu
                    </label>
                  </div>
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="isActive"
                      checked={form.is_active}
                      onChange={(e) => set("is_active", e.target.checked)}
                    />
                    <label className="form-check-label small fw-semibold" htmlFor="isActive" style={{ color: "#0d3a5c" }}>
                      Active
                    </label>
                  </div>
                </div>
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
                {feature ? "Save Changes" : "Create Feature"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Confirm ───────────────────────────────────────────────────────────

const DeleteModal = ({ feature, onConfirm, onClose, deleting }) => (
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
          <h6 className="fw-bold mb-1" style={{ color: "#0d3a5c" }}>Delete Feature?</h6>
          <p className="text-muted small mb-0">
            <strong>{feature.feature_name}</strong> will be soft-deleted.
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

// ─── Feature Detail Drawer ────────────────────────────────────────────────────

// Effective status = global is_active AND enabled for the selected org
// (is_enabled_for_org, annotated by the backend when org-scoped). A globally
// inactive feature is inactive for every org; an org-disabled feature is
// inactive only for that org.
const getEffectiveActive = (feature) =>
  feature?.is_active === true &&
  (typeof feature?.is_enabled_for_org !== "boolean" || feature.is_enabled_for_org === true);

const FeatureDetail = ({ feature, onClose }) => (
  <div
    className="position-fixed top-0 end-0 h-100 hc-feature-drawer"
  >
    <div
      className="px-4 py-3 d-flex align-items-center justify-content-between hc-feature-drawer-head"
    >
      <h6 className="fw-bold text-white mb-0">
        <FaPuzzlePiece className="me-2" />Feature Details
      </h6>
      <button className="btn-close btn-close-white" onClick={onClose}></button>
    </div>
    <div className="p-4 overflow-auto hc-feature-drawer-body">
      <dl className="row row-cols-1 g-3">
        {[
          ["Feature ID", feature.feature_id],
          ["Feature Name", feature.feature_name],
          ["Description", feature.description || "—"],
          ["Category", feature.category_name || feature.category || "—"],
          ["Category ID", feature.category_id ?? "—"],
          ["Parent Feature ID", feature.parent_feature_id ?? "—"],
          ["Availability", Array.isArray(feature.availability_types)
            ? feature.availability_types.map((t) => t.name).join(", ")
            : feature.availability_type?.name || "N/A"],
          ["Menu Label", feature.menu_label || "—"],
          ["Menu Icon", feature.menu_icon || "—"],
          ["Router Link", feature.router_link || "—"],
          ["Menu Order", feature.menu_order ?? "—"],
          ["Show in Menu", feature.show_in_menu ? "Yes" : "No"],
          ["Status", getEffectiveActive(feature) ? "Active" : "Inactive"],
          ["Global Status", feature.is_active ? "Active" : "Inactive"],
          ["Org Status", typeof feature.is_enabled_for_org === "boolean"
            ? (feature.is_enabled_for_org ? "Enabled" : "Disabled")
            : "—"],
          ["Deleted", feature.is_deleted ? "Yes" : "No"],
          ["Created By", feature.created_by ?? "—"],
          ["Created At", feature.created_at ? new Date(feature.created_at).toLocaleString() : "—"],
          ["Updated At", feature.updated_at ? new Date(feature.updated_at).toLocaleString() : "—"],
          ["Permissions", (feature.permissions || []).join(", ") || "—"],
        ].map(([label, value]) => (
          <div key={label} className="col">
            <dt className="small fw-semibold hc-feature-drawer-label">{label}</dt>
            <dd className="mb-0 fw-medium hc-feature-drawer-value">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  </div>
);

// ─── Main FeatureList Component ────────────────────────────────────────────────

const FeatureList = () => {
  const { can, loading: rbacLoading, refreshRBAC } = useRBAC();

  const [features, setFeatures] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [availabilityTypes, setAvailabilityTypes] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortField, setSortField] = useState("feature_name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [viewMode, setViewMode] = useState("grid");

  const [showForm, setShowForm] = useState(false);
  const [editFeature, setEditFeature] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [detailFeature, setDetailFeature] = useState(null);
  const [formError, setFormError] = useState("");
  const toastTimeoutRef = useRef(null);

  const [toast, setToast] = useState(null);

  const [allFeatures, setAllFeatures] = useState([]);
  const fetchAllFeatures = useCallback(async () => {
    try {
      const res = await getFeatures({ is_deleted: false });
      setAllFeatures(res.rows || []);
    } catch (err) {
      console.error("Failed to load all features", err);
      showToast(getApiErrorMessage(err, "Failed to load parent features."), "error");
      setAllFeatures([]);
    }
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const canCreate = can(["features", "feature"], "create");
  const canUpdate = can(["features", "feature"], "update");
  const canDelete = can(["features", "feature"], "delete");

  const showToast = (message, type = "success") => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, categoryFilter, limit, sortField, sortOrder]);

  const fetchFeatures = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const orgId = localStorage.getItem("hc_selected_org_id");
      const isOrgScoped = Boolean(orgId && orgId !== "all");
      const params = {
        page: p,
        limit,
        search: debouncedSearch || undefined,
        sort: `${sortField}:${sortOrder}`,
      };
      if (statusFilter === "deleted") {
        params.is_deleted = true;
      } else if (isOrgScoped) {
        // When an organization is selected, status means the org-effective
        // state. Include org-disabled features so they can be seen and
        // re-enabled, and let the backend filter by org state.
        params.is_deleted = false;
        if (statusFilter === "active") params.org_state = "enabled";
        else if (statusFilter === "inactive") params.org_state = "disabled";
        else params.include_disabled = true;
      } else {
        params.is_deleted = false;
        if (statusFilter === "active") params.is_active = true;
        else if (statusFilter === "inactive") params.is_active = false;
      }
      if (categoryFilter) params.category_id = categoryFilter;

      const res = await getFeatures(params);
      setFeatures(res.rows);
      setPagination(res.pagination);
      setPage(p);
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to load features."), "error");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, categoryFilter, sortField, sortOrder]);

  useEffect(() => { fetchFeatures(1); }, [debouncedSearch, statusFilter, categoryFilter, limit, sortField, sortOrder]);
  useEffect(() => { fetchFeatures(page); }, [page]);

  // Real-time refresh when a feature status changes from any connected app.
  useEffect(() => {
    const handleFeaturesChanged = () => fetchFeatures(page);
    window.addEventListener(FEATURES_CHANGED_EVENT, handleFeaturesChanged);
    return () =>
      window.removeEventListener(FEATURES_CHANGED_EVENT, handleFeaturesChanged);
  }, [page, fetchFeatures]);

  useEffect(() => {
    getFeatureCategoryDropdown()
      .then(setCategories)
      .catch(() => {});
      
    getAvailabilityTypes()
      .then(setAvailabilityTypes)
      .catch(() => {});
  }, []);

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (editFeature) {
        await updateFeature(editFeature.feature_id, formData);
        showToast("Feature updated successfully.");
      } else {
        await createFeature(formData);
        showToast("Feature created successfully.");
      }
      setFormError("");
      setShowForm(false);
      setEditFeature(null);
      fetchFeatures(1);
      refreshRBAC();
    } catch (err) {
      const message = getApiErrorMessage(err, "Failed to save feature.");
      setFormError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteFeature(deleteTarget.feature_id);
      showToast("Feature deleted.");
      setDeleteTarget(null);
      fetchFeatures(1);
      refreshRBAC();
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to delete feature."), "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (feature, scope = "org") => {
    const orgId = localStorage.getItem("hc_selected_org_id");
    const isOrgScoped = Boolean(orgId && orgId !== "all");
    try {
      if (scope === "global") {
        if (feature.is_active) {
          await deactivateFeature(feature.feature_id, { scope: "global" });
          showToast(`${feature.feature_name} deactivated globally.`);
        } else {
          await activateFeature(feature.feature_id, { scope: "global" });
          showToast(`${feature.feature_name} activated globally.`);
        }
      } else if (getEffectiveActive(feature)) {
        await deactivateFeature(feature.feature_id, { scope: "org" });
        showToast(isOrgScoped ? `${feature.feature_name} deactivated for your organization.` : `${feature.feature_name} deactivated.`);
      } else {
        await activateFeature(feature.feature_id, { scope: "org" });
        showToast(isOrgScoped ? `${feature.feature_name} activated for your organization.` : `${feature.feature_name} activated.`);
      }

      fetchFeatures(page);
      refreshRBAC();
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to update status."), "error");
    }
  };

  // Toggle button(s): when an org is selected, show one toggle for the
  // org-scoped state (is_enabled_for_org) and one for the global state
  // (is_active). Without an org scope, only the global toggle is shown.
  const renderStatusToggles = (feature) => {
    if (!canUpdate) return null;
    const orgId = localStorage.getItem("hc_selected_org_id");
    const isOrgScoped = Boolean(orgId && orgId !== "all");
    const effectiveActive = getEffectiveActive(feature);
    return (
      <div className="d-flex justify-content-end gap-1">
        {isOrgScoped && (
          <button
            className={`btn btn-sm rounded-3 hc-feature-action-btn ${effectiveActive ? "hc-feature-action-btn--pause" : "hc-feature-action-btn--play"}`}
            onClick={() => handleToggleStatus(feature, "org")}
            title={effectiveActive ? "Deactivate for this org" : "Activate for this org"}
          >
            {effectiveActive ? <FaPauseCircle /> : <FaPlayCircle />}
          </button>
        )}
        <button
          className={`btn btn-sm rounded-3 hc-feature-action-btn ${feature.is_active ? "hc-feature-action-btn--pause" : "hc-feature-action-btn--play"}`}
          onClick={() => handleToggleStatus(feature, "global")}
          title={feature.is_active ? "Deactivate globally" : "Activate globally"}
        >
          {feature.is_active ? <FaPauseCircle /> : <FaPlayCircle />}
        </button>
      </div>
    );
  };

  const totalPages = pagination
    ? pagination.totalPages || Math.ceil((pagination.total || 0) / limit)
    : 1;

  const totalItems = pagination?.total || features.length;
  const activeItems = features.filter((feature) => getEffectiveActive(feature)).length;
  const visibleItems = features.filter((feature) => Boolean(feature.show_in_menu)).length;

  const openDetail = (feature) => {
    setDetailFeature(feature);
    getFeatureById(feature.feature_id)
      .then((detail) => setDetailFeature(detail || feature))
      .catch(() => {});
  };

  if (rbacLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border" style={{ color: "#1a709b" }}></div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-3 px-md-4 hc-feature-lab">
      <ToastMessage toast={toast} />

      {/* Detail Overlay */}
      {detailFeature && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 hc-feature-overlay"
          onClick={() => setDetailFeature(null)}
        />
      )}
      {detailFeature && (
        <FeatureDetail feature={detailFeature} onClose={() => setDetailFeature(null)} />
      )}

      {/* Modals */}
      {showForm && (
        <FeatureFormModal
          feature={editFeature}
          categories={categories}
          featureOptions={allFeatures}
          availabilityTypes={availabilityTypes}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditFeature(null);
            setFormError("");
          }}
          saving={saving}
          errorMessage={formError}
          onClearError={() => setFormError("")}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          feature={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {/* Header */}
      <div className="hc-feature-hero mb-4">
        <div className="hc-feature-hero-bg" aria-hidden="true"></div>
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-4 position-relative">
          <div>
            <div className="hc-feature-kicker">Feature Control Center</div>
            <h4 className="fw-bold mb-2 hc-feature-heading">
              <FaMicrochip className="me-2" />
              Features Management
            </h4>
            <p className="mb-0 hc-feature-subhead">
              Configure core capabilities, menu presence, routing, and permissions from one command surface.
            </p>
          </div>
          <div className="d-flex flex-column align-items-stretch align-items-md-end gap-3">
            <div className="d-flex flex-wrap justify-content-md-end gap-2">
              <span className="hc-feature-stat-pill">
                <FaLayerGroup className="me-2" />
                {totalItems} total
              </span>
              <span className="hc-feature-stat-pill">
                <FaCheckCircle className="me-2" />
                {activeItems} active
              </span>
              <span className="hc-feature-stat-pill">
                <FaEye className="me-2" />
                {visibleItems} visible
              </span>
            </div>
            {canCreate && (
              <button
                className="btn hc-feature-primary-btn rounded-3 px-4 d-flex align-items-center gap-2"
                onClick={() => {
                  setEditFeature(null);
                  setFormError("");
                  fetchAllFeatures().then(() => setShowForm(true));
                }}
              >
                <FaPlus />
                New Feature
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className="card border-0 rounded-4 mb-4 hc-feature-filter-shell"
      >
        <div className="card-body py-3 px-4">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-5">
              <div className="input-group rounded-3 overflow-hidden hc-feature-search-wrap">
                <span className="input-group-text bg-white border-0 text-muted">
                  <FaSearch />
                </span>
                <input
                  className="form-control border-0 shadow-none hc-feature-search-input"
                  placeholder="Search features..."
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
                className="form-select rounded-3 hc-feature-filter-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.category_id || c.id} value={c.category_id || c.id}>
                    {c.name || c.category_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <select
                className="form-select rounded-3 hc-feature-filter-select"
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
                className="form-select rounded-3 hc-feature-filter-select"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={10}>10 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={500}>500 / page</option>
              </select>
            </div>
            <div className="col-12 col-md-12 d-flex justify-content-md-end">
              <div className="hc-feature-view-toggle">
                <button
                  type="button"
                  className={`hc-feature-view-btn${viewMode === "grid" ? " is-active" : ""}`}
                  onClick={() => setViewMode("grid")}
                >
                  <FaThLarge className="me-1" />
                  Grid
                </button>
                <button
                  type="button"
                  className={`hc-feature-view-btn${viewMode === "table" ? " is-active" : ""}`}
                  onClick={() => setViewMode("table")}
                >
                  <FaTable className="me-1" />
                  Table
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className="card border-0 rounded-4 hc-feature-table-shell"
      >
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color: "#1a709b" }}></div>
            <p className="text-muted mt-2 small">Loading features...</p>
          </div>
        ) : features.length === 0 ? (
          <div className="text-center py-5">
            <FaPuzzlePiece className="fs-1 text-muted opacity-40" />
            <p className="text-muted mt-2">No features found.</p>
          </div>
        ) : viewMode === "table" ? (
          <div className="table-responsive">
            <table className="table align-middle mb-0 hc-feature-table">
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th className="px-4 py-3 fw-semibold small" style={{ color: "#64748b" }}>#</th>
                  <th className="py-3 fw-semibold small hc-fam-th-sortable" style={{ color: "#64748b", cursor: "pointer" }} onClick={() => handleSort("feature_name")}>
                    Feature
                    {sortField === "feature_name" && (sortOrder === "asc" ? <FaChevronUp className="ms-1" /> : <FaChevronDown className="ms-1" />)}
                  </th>
                  <th className="py-3 fw-semibold small hc-fam-th-sortable" style={{ color: "#64748b", cursor: "pointer" }} onClick={() => handleSort("category_name")}>
                    Category
                    {sortField === "category_name" && (sortOrder === "asc" ? <FaChevronUp className="ms-1" /> : <FaChevronDown className="ms-1" />)}
                  </th>
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Availability</th>
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Router Link</th>
                  <th className="py-3 fw-semibold small text-center" style={{ color: "#64748b" }}>Menu</th>
                  <th className="py-3 fw-semibold small text-center hc-fam-th-sortable" style={{ color: "#64748b", cursor: "pointer" }} onClick={() => handleSort("is_active")}>
                    Status
                    {sortField === "is_active" && (sortOrder === "asc" ? <FaChevronUp className="ms-1" /> : <FaChevronDown className="ms-1" />)}
                  </th>
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Updated</th>
                  <th className="py-3 fw-semibold small text-end pe-4" style={{ color: "#64748b" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, idx) => (
                  <tr
                    key={feature.feature_id}
                    className="hc-feature-table-row"
                    onClick={() => openDetail(feature)}
                  >
                    <td className="px-4 text-muted small">{(page - 1) * limit + idx + 1}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0 hc-feature-table-icon"
                        >
                          {feature.menu_icon ? (
                            <IconRenderer icon={feature.menu_icon} />
                          ) : (
                            <FaPuzzlePiece />
                          )}
                        </div>
                        <div>
                          <div className="fw-semibold" style={{ color: "#1e293b" }}>
                            {feature.feature_name}
                          </div>
                          <div className="d-flex flex-wrap gap-1 mt-1">
                            <span className="hc-feature-meta-chip">ID {feature.feature_id}</span>
                            <span className="hc-feature-meta-chip">Parent {feature.parent_feature_id ?? "Root"}</span>
                            <span className="hc-feature-meta-chip">Order {feature.menu_order ?? 0}</span>
                            {feature.menu_label ? <span className="hc-feature-meta-chip">{feature.menu_label}</span> : null}
                            {feature.menu_icon ? <span className="hc-feature-meta-chip">{feature.menu_icon}</span> : null}
                          </div>
                          {feature.description && (
                            <div
                              className="text-muted"
                              style={{
                                fontSize: "0.75rem",
                                maxWidth: 200,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {feature.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-muted small">{feature.category_name || "—"}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {(Array.isArray(feature.availability_types) ? feature.availability_types : [])
                          .map((t) => (
                            <span key={t.availability_type_id} className="hc-feature-meta-chip">{t.name}</span>
                          ))}
                        {!feature.availability_types?.length && <span className="hc-feature-meta-chip">N/A</span>}
                      </div>
                    </td>
                    <td>
                      {feature.router_link ? (
                        <code className="small hc-feature-route-code">
                          {feature.router_link}
                        </code>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                    <td className="text-center">
                      {feature.show_in_menu ? (
                        <span className="badge rounded-pill px-2 py-1 hc-feature-visibility-chip hc-feature-visibility-chip--visible">
                          <FaEyeSolid className="me-1" />Visible
                        </span>
                      ) : (
                        <span className="badge rounded-pill px-2 py-1 hc-feature-visibility-chip hc-feature-visibility-chip--hidden">
                          Hidden
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <StatusBadge active={getEffectiveActive(feature)} />
                    </td>
                    <td>
                      <div className="text-muted small">{feature.updated_at ? new Date(feature.updated_at).toLocaleDateString() : "—"}</div>
                      <div
                        className="small text-muted d-inline-block"
                        style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={(feature.permissions || []).join(", ")}
                      >
                        {(feature.permissions || []).join(", ") || "—"}
                      </div>
                    </td>
                    <td className="text-end pe-4" onClick={(e) => e.stopPropagation()}>
                      <div className="d-flex justify-content-end gap-1 hc-feature-action-group">
                        {/* Toggle */}
                        {renderStatusToggles(feature)}

                        {/* Edit */}
                        {canUpdate && (
                          <button
                            className="btn btn-sm rounded-3 hc-feature-action-btn hc-feature-action-btn--edit"
                            onClick={() => {
                              setEditFeature(feature);
                              setFormError("");
                              fetchAllFeatures().then(() => setShowForm(true));
                            }}
                            title="Edit"
                          >
                            <FaPencilAlt />
                          </button>
                        )}

                        {/* Delete */}
                        {canDelete && (
                          <button
                            className="btn btn-sm rounded-3 hc-feature-action-btn hc-feature-action-btn--delete"
                            onClick={() => setDeleteTarget(feature)}
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
        ) : (
          <div className="p-3 p-md-4">
            <div className="hc-feature-grid">
              {features.map((feature) => (
                <article
                  key={feature.feature_id}
                  className="hc-feature-card"
                  onClick={() => openDetail(feature)}
                >
                  <div className="hc-feature-card-head">
                    <div className="d-flex align-items-center gap-2 min-w-0">
                      <div className="hc-feature-card-icon">
                        {feature.menu_icon ? (
                          <IconRenderer icon={feature.menu_icon} />
                        ) : (
                          <FaPuzzlePiece />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h6 className="mb-0 hc-feature-card-title text-truncate">{feature.feature_name}</h6>
                        <div className="hc-feature-card-sub text-truncate">{feature.category_name || "Uncategorized"}</div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {renderStatusToggles(feature)}
                      {canUpdate && (
                        <button
                          className="btn btn-sm rounded-3 hc-feature-action-btn hc-feature-action-btn--edit"
                          onClick={() => {
                            setEditFeature(feature);
                            setFormError("");
                            fetchAllFeatures().then(() => setShowForm(true));
                          }}
                          title="Edit"
                        >
                          <FaPencilAlt />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="btn btn-sm rounded-3 hc-feature-action-btn hc-feature-action-btn--delete"
                          onClick={() => setDeleteTarget(feature)}
                          title="Delete"
                        >
                          <FaTrashAlt />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="hc-feature-card-body">
                    <div className="hc-feature-card-row">
                      <span className="hc-feature-card-key">ID</span>
                      <span className="hc-feature-card-val">{feature.feature_id}</span>
                    </div>
                    <div className="hc-feature-card-row">
                      <span className="hc-feature-card-key">Parent</span>
                      <span className="hc-feature-card-val">{feature.parent_feature_id ?? "Root"}</span>
                    </div>
                    <div className="hc-feature-card-row">
                      <span className="hc-feature-card-key">Route</span>
                      <code className="hc-feature-card-code text-truncate">{feature.router_link || "—"}</code>
                    </div>
                    <div className="hc-feature-card-row">
                      <span className="hc-feature-card-key">Availability</span>
                      <span className="hc-feature-card-val">
                        {(Array.isArray(feature.availability_types) ? feature.availability_types : [])
                          .map((t) => t.name).join(", ") || "N/A"}
                      </span>
                    </div>
                    <div className="hc-feature-card-row">
                      <span className="hc-feature-card-key">Updated</span>
                      <span className="hc-feature-card-val">{feature.updated_at ? new Date(feature.updated_at).toLocaleDateString() : "—"}</span>
                    </div>
                  </div>

                  <div className="hc-feature-card-foot">
                    {feature.show_in_menu ? (
                      <span className="badge rounded-pill px-2 py-1 hc-feature-visibility-chip hc-feature-visibility-chip--visible">
                        <FaEyeSolid className="me-1" />Visible
                      </span>
                    ) : (
                      <span className="badge rounded-pill px-2 py-1 hc-feature-visibility-chip hc-feature-visibility-chip--hidden">
                        Hidden
                      </span>
                    )}
                    <StatusBadge active={getEffectiveActive(feature)} />
                  </div>
                </article>
              ))}
            </div>
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
                className="btn btn-sm rounded-3 border hc-feature-page-btn"
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
                    className={`btn btn-sm rounded-3 border hc-feature-page-btn${p === page ? " is-active" : ""}`}
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
                className="btn btn-sm rounded-3 border hc-feature-page-btn"
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

export default FeatureList;
