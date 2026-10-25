import { useState, useEffect } from "react";
import { FaThLarge, FaTimes, FaTag, FaExclamationCircle, FaFont, FaSortNumericUp } from "react-icons/fa";

const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";
const ACCENT = "#1a709b";

const fieldStyle = {
  borderRadius: "10px",
  padding: "0.65rem 1rem",
  border: "1.5px solid #e2e8f0",
  background: "#f8fafc",
  fontSize: "0.9rem",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const iconMap = {
  "bi-tag": FaTag,
  "bi-sort-numeric-up": FaSortNumericUp,
};

const SectionLabel = ({ icon, children }) => {
  const IconComp = iconMap[icon];
  return (
    <div className="d-flex align-items-center gap-2 mb-3" style={{ borderBottom: "1px solid #f0f4f8", paddingBottom: "0.5rem" }}>
      {IconComp ? <IconComp style={{ color: ACCENT, fontSize: "0.95rem" }} /> : <i className={`bi ${icon}`} style={{ color: ACCENT, fontSize: "0.95rem" }} />}
      <span className="fw-semibold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.08em", color: "#64748b" }}>
        {children}
      </span>
    </div>
  );
};

const FeatureAvailabilityForm = ({ type, onSave, onCancel, isEditing, isLoading }) => {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    display_order: 0,
    is_active: true,
  });

  const [errors, setErrors] = useState({});
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    if (type) {
      setFormData({
        code: type.code || "",
        name: type.name || "",
        description: type.description || "",
        display_order: type.display_order ?? 0,
        is_active: type.is_active ?? true,
      });
    } else {
      setFormData({
        code: "",
        name: "",
        description: "",
        display_order: 0,
        is_active: true,
      });
    }
  }, [type]);

  const validate = () => {
    const errs = {};
    if (!formData.code.trim()) errs.code = "Code is required.";
    if (!formData.name.trim()) errs.name = "Name is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newValue = name === "display_order" ? (value === "" ? "" : Number(value)) : value;
    setFormData((prev) => ({ ...prev, [name]: newValue }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      display_order: formData.display_order === "" ? 0 : formData.display_order,
      is_active: formData.is_active,
    });
  };

  const focusStyle = (field) =>
    focusedField === field
      ? { ...fieldStyle, borderColor: ACCENT, boxShadow: `0 0 0 3px rgba(26,112,155,0.12)`, background: "#fff" }
      : fieldStyle;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        backgroundColor: "rgba(10,20,35,0.55)",
        backdropFilter: "blur(3px)",
        zIndex: 1050,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onCancel(); }}
    >
      <div
        style={{
          width: "100%", maxWidth: "760px",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)",
          display: "flex",
          maxHeight: "92vh",
        }}
      >
        {/* Left Brand Panel */}
        <div
          style={{
            width: "200px", flexShrink: 0,
            background: BRAND,
            padding: "2.5rem 1.75rem",
            display: "flex", flexDirection: "column",
            justifyContent: "space-between",
            position: "relative", overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "150px", height: "150px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
          <div style={{ position: "absolute", bottom: "-30px", left: "-30px", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                width: "52px", height: "52px", borderRadius: "14px",
                background: "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "1.5rem",
                backdropFilter: "blur(4px)",
              }}
            >
              <FaThLarge style={{ color: "white", fontSize: "1.5rem" }} />
            </div>

            <h5 className="text-white fw-bold mb-1" style={{ fontSize: "1.05rem", lineHeight: 1.3 }}>
              {isEditing ? "Edit Availability Type" : "New Availability Type"}
            </h5>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.78rem", lineHeight: 1.5 }}>
              {isEditing
                ? "Update the details for this availability type."
                : "Create a new feature availability type."}
            </p>
          </div>

          {/* Field legend */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {[
              { icon: "bi-tag", FaIcon: FaTag, text: "Code & Name" },
              { icon: "bi-text-paragraph", FaIcon: null, text: "Description" },
              { icon: "bi-sort-numeric-up", FaIcon: FaSortNumericUp, text: "Display Order" },
              { icon: "bi-toggle-on", FaIcon: null, text: "Status" },
            ].map(({ icon, FaIcon, text }) => (
              <div key={text} className="d-flex align-items-center gap-2 mb-2">
                {FaIcon ? <FaIcon style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }} /> : <i className={`bi ${icon}`} style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", width: "14px" }} />}
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.73rem" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Form Panel */}
        <div style={{ flex: 1, background: "#fff", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {/* Top bar */}
          <div style={{ padding: "1.25rem 1.75rem", borderBottom: "1px solid #f0f4f8", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8" }}>
                {isEditing ? `ID #${type?.availability_type_id || type?.id}` : "All fields marked * are required"}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              style={{
                background: "#f1f5f9", border: "none", borderRadius: "8px",
                width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#64748b", transition: "background 0.2s",
              }}
            >
              <FaTimes style={{ fontSize: "0.85rem" }} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate style={{ padding: "1.75rem", flex: 1 }}>

            {/* Section 1 — Code & Name */}
            <SectionLabel icon="bi-tag">Code &amp; Name</SectionLabel>
            <div className="row g-3 mb-4">
              <div className="col-md-5">
                <label className="form-label fw-medium mb-1" style={{ fontSize: "0.82rem", color: "#374151" }}>
                  Code <span className="text-danger">*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <FaTag style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.9rem", pointerEvents: "none" }} />
                  <input
                    type="text"
                    className={`form-control ${errors.code ? "is-invalid" : ""}`}
                    style={{ ...focusStyle("code"), paddingLeft: "2.2rem" }}
                    name="code"
                    value={formData.code}
                    onChange={(e) => {
                      const upper = e.target.value.toUpperCase();
                      setFormData((prev) => ({ ...prev, code: upper }));
                      if (errors.code) setErrors((prev) => ({ ...prev, code: "" }));
                    }}
                    onFocus={() => setFocusedField("code")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="e.g. REACT"
                    disabled={isEditing}
                    readOnly={isEditing}
                  />
                </div>
                {errors.code && <div className="text-danger mt-1" style={{ fontSize: "0.78rem" }}><FaExclamationCircle className="me-1" />{errors.code}</div>}
                {isEditing && <small className="text-muted" style={{ fontSize: "0.72rem" }}>Code cannot be changed after creation.</small>}
              </div>

              <div className="col-md-7">
                <label className="form-label fw-medium mb-1" style={{ fontSize: "0.82rem", color: "#374151" }}>
                  Name <span className="text-danger">*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <FaFont style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.9rem", pointerEvents: "none" }} />
                  <input
                    type="text"
                    className={`form-control ${errors.name ? "is-invalid" : ""}`}
                    style={{ ...focusStyle("name"), paddingLeft: "2.2rem" }}
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    onFocus={() => setFocusedField("name")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="e.g. React Web App"
                  />
                </div>
                {errors.name && <div className="text-danger mt-1" style={{ fontSize: "0.78rem" }}><FaExclamationCircle className="me-1" />{errors.name}</div>}
              </div>
            </div>

            {/* Section 2 — Description */}
            <SectionLabel icon="bi-text-paragraph">Description</SectionLabel>
            <div className="mb-4">
              <textarea
                className="form-control"
                style={{ ...focusStyle("description"), minHeight: "80px", resize: "vertical" }}
                name="description"
                value={formData.description}
                onChange={handleChange}
                onFocus={() => setFocusedField("description")}
                onBlur={() => setFocusedField(null)}
                placeholder="Briefly describe this availability type (optional)"
                rows={3}
              />
              <div className="text-end mt-1" style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                {formData.description.length} chars
              </div>
            </div>

            {/* Section 3 — Display Order & Status */}
            <SectionLabel icon="bi-sort-numeric-up">Display Order &amp; Status</SectionLabel>
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <label className="form-label fw-medium mb-1" style={{ fontSize: "0.82rem", color: "#374151" }}>
                  Display Order
                </label>
                <div style={{ position: "relative" }}>
                  <FaSortNumericUp style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.9rem", pointerEvents: "none" }} />
                  <input
                    type="number"
                    className="form-control"
                    style={{ ...focusStyle("display_order"), paddingLeft: "2.2rem" }}
                    name="display_order"
                    value={formData.display_order}
                    onChange={handleChange}
                    onFocus={() => setFocusedField("display_order")}
                    onBlur={() => setFocusedField(null)}
                    min={0}
                    step={1}
                  />
                </div>
              </div>

              <div className="col-md-8">
                <label className="form-label fw-medium mb-1" style={{ fontSize: "0.82rem", color: "#374151" }}>
                  Status
                </label>
                <div className="d-flex gap-2">
                  {[true, false].map((s) => {
                    const active = formData.is_active === s;
                    const isActive = s === true;
                    return (
                      <button
                        key={String(s)}
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, is_active: s }))}
                        style={{
                          flex: 1,
                          padding: "0.6rem",
                          borderRadius: "10px",
                          border: active
                            ? `2px solid ${isActive ? "#16a34a" : "#dc2626"}`
                            : "1.5px solid #e2e8f0",
                          background: active
                            ? isActive ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.06)"
                            : "#f8fafc",
                          color: active ? (isActive ? "#16a34a" : "#dc2626") : "#94a3b8",
                          fontWeight: active ? 600 : 400,
                          fontSize: "0.82rem",
                          cursor: "pointer",
                          transition: "all 0.18s",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                        }}
                      >
                        <i className={`bi ${isActive ? "bi-check-circle" : "bi-dash-circle"}`} style={{ fontSize: "0.85rem" }} />
                        {isActive ? "Active" : "Inactive"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="d-flex justify-content-end gap-2 pt-3" style={{ borderTop: "1px solid #f0f4f8" }}>
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                style={{
                  padding: "0.6rem 1.5rem", borderRadius: "10px",
                  border: "1.5px solid #e2e8f0", background: "#f8fafc",
                  color: "#64748b", fontWeight: 500, fontSize: "0.88rem",
                  cursor: "pointer", transition: "all 0.18s",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  padding: "0.6rem 1.75rem", borderRadius: "10px",
                  background: BRAND, border: "none",
                  color: "#fff", fontWeight: 600, fontSize: "0.88rem",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.75 : 1,
                  display: "flex", alignItems: "center", gap: "8px",
                  transition: "opacity 0.18s",
                }}
              >
                {isLoading ? (
                  <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />{isEditing ? "Saving..." : "Creating..."}</>
                ) : (
                  <><i className={`bi ${isEditing ? "bi-check-lg" : "bi-plus-lg"}`} />{isEditing ? "Save Changes" : "Create Type"}</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FeatureAvailabilityForm;
