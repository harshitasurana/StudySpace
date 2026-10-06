import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createFeature,
  getFeatureCategoryDropdown,
  getFeatures,
  getAvailabilityTypes,
} from "../../services/roleFeatureService.js";
import { getApiErrorMessage } from "../../services/errorMessage.js";
import { FaPlusSquare, FaTags, FaProjectDiagram, FaKey, FaBars, FaCheckCircle } from "react-icons/fa";
import ToastMessage from "../../shared/component/ToastMessage.jsx";
import "./AddFeaturePage.css";

const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";

const toPermissionToken = (token) => {
  const raw = String(token || "").trim().toLowerCase();
  if (!raw) return "";
  return raw.startsWith("can_") ? raw.slice(4).toUpperCase() : raw.toUpperCase();
};


const AddFeaturePage = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [toast, setToast] = useState(null);

  const [categories, setCategories] = useState([]);
  const [featureOptions, setFeatureOptions] = useState([]);
  const [availabilityTypes, setAvailabilityTypes] = useState([]);

  const [form, setForm] = useState({
    feature_name: "",
    description: "",
    category_id: "",
    parent_feature_id: "",
    availability_type_ids: [],
    permissions_text: "CREATE, READ, UPDATE, DELETE",
    menu_label: "",
    menu_icon: "",
    router_link: "",
    menu_order: 0,
    show_in_menu: true,
    is_active: true,
  });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    const loadMeta = async () => {
      setLoadingMeta(true);
      try {
        const [categoryResult, featureResult, availabilityResult] = await Promise.allSettled([
          getFeatureCategoryDropdown(),
          getFeatures({ is_deleted: false }).then((res) => res.rows || []),
          getAvailabilityTypes(),
        ]);

        if (categoryResult.status === "fulfilled") {
          setCategories(categoryResult.value || []);
        } else {
          setCategories([]);
          showToast(getApiErrorMessage(categoryResult.reason, "Failed to load categories."), "error");
        }

        if (featureResult.status === "fulfilled") {
          setFeatureOptions(featureResult.value || []);
        } else {
          setFeatureOptions([]);
          showToast(getApiErrorMessage(featureResult.reason, "Failed to load parent features."), "error");
        }

        if (availabilityResult.status === "fulfilled") {
          setAvailabilityTypes(availabilityResult.value || []);
        } else {
          setAvailabilityTypes([]);
        }
      } catch (error) {
        showToast(getApiErrorMessage(error, "Failed to load add-feature form data."), "error");
      } finally {
        setLoadingMeta(false);
      }
    };

    loadMeta();
  }, []);

  const normalizedPermissions = useMemo(
    () =>
      String(form.permissions_text || "")
        .split(",")
        .map(toPermissionToken)
        .filter(Boolean),
    [form.permissions_text]
  );

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const toggleAvailabilityType = (id) => {
    setForm((current) => {
      const ids = current.availability_type_ids.includes(id)
        ? current.availability_type_ids.filter((i) => i !== id)
        : [...current.availability_type_ids, id];
      return { ...current, availability_type_ids: ids };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        feature_name: String(form.feature_name || "").trim(),
        description: String(form.description || "").trim(),
        category_id: form.category_id ? Number(form.category_id) : null,
        parent_feature_id: form.parent_feature_id ? Number(form.parent_feature_id) : null,
        availability_type_ids: form.availability_type_ids,
        permissions: normalizedPermissions,
        menu_label: String(form.menu_label || "").trim(),
        menu_icon: String(form.menu_icon || "").trim(),
        router_link: String(form.router_link || "").trim(),
        menu_order: Number(form.menu_order || 0),
        show_in_menu: Boolean(form.show_in_menu),
        is_active: Boolean(form.is_active),
      };

      await createFeature(payload);
      showToast("Feature created successfully.");
      window.setTimeout(() => navigate("/admin/features"), 900);
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to create feature."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-3 px-md-4 hc-add-feature">
      <ToastMessage toast={toast} />

      <div className="hc-add-hero mb-4">
        <div className="position-relative d-flex flex-wrap align-items-start justify-content-between gap-4">
          <div>
            <div className="hc-add-kicker">Feature Provisioning</div>
            <h4 className="mb-2 fw-bold hc-add-title">
              <FaPlusSquare className="me-2" />
              Create New Feature
            </h4>
            <p className="mb-0 hc-add-subtitle">
              Define feature metadata, permissions, and menu behavior in one high-precision admin workflow.
            </p>
          </div>
          <div className="d-flex flex-wrap justify-content-md-end gap-2">
            <span className="hc-add-chip"><FaTags className="me-1" />{categories.length} categories</span>
            <span className="hc-add-chip"><FaProjectDiagram className="me-1" />{featureOptions.length} parent options</span>
            <span className="hc-add-chip"><FaKey className="me-1" />{normalizedPermissions.length} permissions</span>
          </div>
        </div>
      </div>

      <div className="card border-0 rounded-4 hc-add-form-shell">
        <div className="card-body p-3 p-md-4">
          {loadingMeta ? (
            <div className="text-center py-5">
              <div className="spinner-border" style={{ color: "#1a709b" }}></div>
              <p className="text-muted mt-2 mb-0 small">Loading form data...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label hc-add-label">Feature Name *</label>
                <input
                  className="form-control hc-add-input"
                  value={form.feature_name}
                  onChange={(event) => set("feature_name", event.target.value)}
                  required
                  maxLength={100}
                  placeholder="e.g. Feature Permissions"
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label hc-add-label">Category</label>
                <select
                  className="form-select hc-add-select"
                  value={form.category_id}
                  onChange={(event) => set("category_id", event.target.value)}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.category_id || category.id} value={category.category_id || category.id}>
                      {category.name || category.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label hc-add-label">Parent Feature</label>
                <select
                  className="form-select hc-add-select"
                  value={form.parent_feature_id}
                  onChange={(event) => set("parent_feature_id", event.target.value)}
                >
                  <option value="">Root Level</option>
                  {featureOptions.map((feature) => (
                    <option key={feature.feature_id} value={feature.feature_id}>
                      {feature.feature_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label hc-add-label">Availability *</label>
                <div className="hc-multi-checkbox-group border rounded-3 p-3" style={{ maxHeight: 200, overflowY: "auto" }}>
                  {availabilityTypes.map((type) => (
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
                  {availabilityTypes.length === 0 && (
                    <span className="text-muted small">No availability types configured</span>
                  )}
                </div>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label hc-add-label">Permissions (comma separated)</label>
                <input
                  className="form-control hc-add-input"
                  value={form.permissions_text}
                  onChange={(event) => set("permissions_text", event.target.value)}
                  placeholder="CREATE, READ, UPDATE, DELETE"
                />
              </div>

              <div className="col-12">
                <label className="form-label hc-add-label">Description</label>
                <textarea
                  className="form-control hc-add-textarea"
                  value={form.description}
                  onChange={(event) => set("description", event.target.value)}
                  maxLength={500}
                  placeholder="Short description for this feature"
                />
              </div>

              <div className="col-12">
                <div className="hc-add-section-title">
                  <FaBars />
                  Menu Settings
                </div>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label hc-add-label">Menu Label</label>
                <input
                  className="form-control hc-add-input"
                  value={form.menu_label}
                  onChange={(event) => set("menu_label", event.target.value)}
                  maxLength={100}
                  placeholder="e.g. Feature Permissions"
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label hc-add-label">Menu Icon</label>
                <input
                  className="form-control hc-add-input"
                  value={form.menu_icon}
                  onChange={(event) => set("menu_icon", event.target.value)}
                  maxLength={200}
                  placeholder="e.g. pi pi-sliders-h"
                />
              </div>

              <div className="col-12 col-md-8">
                <label className="form-label hc-add-label">Router Link</label>
                <input
                  className="form-control hc-add-input"
                  value={form.router_link}
                  onChange={(event) => set("router_link", event.target.value)}
                  maxLength={255}
                  placeholder="/feature-permissions"
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label hc-add-label">Menu Order</label>
                <input
                  type="number"
                  min={0}
                  className="form-control hc-add-input"
                  value={form.menu_order}
                  onChange={(event) => set("menu_order", event.target.value)}
                />
              </div>

              <div className="col-12 d-flex flex-wrap gap-2">
                <label className="hc-add-toggle-wrap">
                  <input
                    type="checkbox"
                    className="form-check-input mt-0"
                    checked={form.show_in_menu}
                    onChange={(event) => set("show_in_menu", event.target.checked)}
                  />
                  <span className="small fw-semibold">Show in Menu</span>
                </label>

                <label className="hc-add-toggle-wrap">
                  <input
                    type="checkbox"
                    className="form-check-input mt-0"
                    checked={form.is_active}
                    onChange={(event) => set("is_active", event.target.checked)}
                  />
                  <span className="small fw-semibold">Active</span>
                </label>
              </div>

              <div className="col-12 d-flex justify-content-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-3"
                  onClick={() => navigate("/admin/features")}
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
                  {saving ? <span className="spinner-border spinner-border-sm me-2"></span> : <FaCheckCircle className="me-2" />}
                  Create Feature
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddFeaturePage;
