import React, { useEffect, useState } from "react";

const emptyForm = {
  name: "",
  code: "",
  description: "",
  is_active: true,
};

/**
 * Create / Edit modal for a Category Type.
 * `mode` is 'create' or 'edit'. `initialData` is the row object when editing.
 */
const CategoryTypeForm = ({ mode, initialData, saving, onSubmit, onClose }) => {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setForm({
        name: initialData.name || "",
        code: initialData.code || "",
        description: initialData.description || "",
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
    if (!form.name || !form.name.trim()) next.name = "Name is required";
    if (!form.code || !form.code.trim()) next.code = "Code is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description,
    };

    if (mode === "edit") {
      payload.is_active = !!form.is_active;
    }

    onSubmit(payload);
  };

  const title = mode === "create" ? "New Category Type" : "Edit Category Type";

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

        <form onSubmit={handleSubmit}>
          <div className="cat-modal-body">
            <div className="cat-form-group">
              <label htmlFor="type-name">
                Name <span className="req">*</span>
              </label>
              <input
                id="type-name"
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="e.g. Pharmacy"
              />
              {errors.name && <p className="cat-form-error">{errors.name}</p>}
            </div>

            <div className="cat-form-group">
              <label htmlFor="type-code">
                Code <span className="req">*</span>
              </label>
              <input
                id="type-code"
                type="text"
                value={form.code}
                onChange={(e) => setField("code", e.target.value)}
                placeholder="e.g. pharmacy"
                disabled={mode === "edit"}
              />
              {errors.code && <p className="cat-form-error">{errors.code}</p>}
              {mode === "edit" && (
                <p className="cat-form-error" style={{ color: "#9ca3af" }}>
                  Code cannot be changed after creation.
                </p>
              )}
            </div>

            <div className="cat-form-group">
              <label htmlFor="type-desc">Description</label>
              <textarea
                id="type-desc"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Optional description"
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
      </div>
    </div>
  );
};

export default CategoryTypeForm;