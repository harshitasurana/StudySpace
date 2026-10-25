import React, { useEffect, useState } from "react";

const emptyForm = {
  type: "",
  name: "",
  code: "",
  description: "",
  display_order: 0,
  is_active: true,
};

/**
 * Create / Edit modal for a Category.
 * `mode` is 'create' or 'edit'. When editing, `initialData` is the full
 * category record (as returned by GET /categories/:id).
 */
const CategoryListForm = ({
  mode,
  initialData,
  categoryTypes,
  loading,
  saving,
  onSubmit,
  onClose,
}) => {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setForm({
        type: initialData.CategoryType?.code || initialData.category_type?.code || "",
        name: initialData.name || "",
        code: initialData.code || "",
        description: initialData.description || "",
        display_order: initialData.display_order ?? 0,
        is_active: initialData.is_active ?? true,
      });
    } else if (mode === "create") {
      setForm(emptyForm);
    }
  }, [mode, initialData]);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.type) next.type = "Category type is required";
    if (!form.name || !form.name.trim()) next.name = "Category name is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      type: form.type,
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description,
      display_order: Number(form.display_order) || 0,
    };

    if (mode === "edit") {
      payload.is_active = !!form.is_active;
    }

    onSubmit(payload);
  };

  const title = mode === "create" ? "New Category" : "Edit Category";

  return (
    <div className="cat-modal-overlay" onClick={() => !saving && onClose()}>
      <div className="cat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cat-modal-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="cat-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {loading ? (
          <div className="cat-modal-body">
            <div className="cat-state" style={{ border: "none", padding: "30px 0" }}>
              <div className="cat-spinner" />
              <p>Loading category…</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="cat-modal-body">
              <div className="cat-form-group">
                <label htmlFor="cat-type">
                  Category Type <span className="req">*</span>
                </label>
                <select
                  id="cat-type"
                  value={form.type}
                  onChange={(e) => setField("type", e.target.value)}
                >
                  <option value="">Select category type</option>
                  {categoryTypes.map((t) => (
                    <option key={t.category_type_id} value={t.code}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {errors.type && <p className="cat-form-error">{errors.type}</p>}
              </div>

              <div className="cat-form-group">
                <label htmlFor="cat-name">
                  Category Name <span className="req">*</span>
                </label>
                <input
                  id="cat-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g. Cardiology"
                />
                {errors.name && <p className="cat-form-error">{errors.name}</p>}
              </div>

              <div className="cat-form-group">
                <label htmlFor="cat-code">Code</label>
                <input
                  id="cat-code"
                  type="text"
                  value={form.code}
                  onChange={(e) => setField("code", e.target.value)}
                  placeholder="Auto-generated if left blank"
                />
              </div>

              <div className="cat-form-group">
                <label htmlFor="cat-desc">Description</label>
                <textarea
                  id="cat-desc"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Optional description"
                />
              </div>

              <div className="cat-form-group">
                <label htmlFor="cat-order">Display Order</label>
                <input
                  id="cat-order"
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setField("display_order", e.target.value)}
                />
              </div>

              {mode === "edit" && (
                <div className="cat-form-group">
                  <label>Status</label>
                  <div className="cat-form-row">
                    <label className="cat-switch">
                      <input
                        type="checkbox"
                        checked={!!form.is_active}
                        onChange={(e) => setField("is_active", e.target.checked)}
                      />
                      <span className="cat-switch-track" />
                    </label>
                    <span>{form.is_active ? "Active" : "Inactive"}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="cat-modal-footer">
              <button
                type="button"
                className="cat-btn cat-btn-secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="cat-btn cat-btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CategoryListForm;