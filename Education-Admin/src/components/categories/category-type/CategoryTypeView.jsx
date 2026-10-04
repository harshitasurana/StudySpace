import React from "react";

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Field = ({ label, children, full }) => (
  <div className={`cat-view-field ${full ? "full" : ""}`}>
    <label>{label}</label>
    <p>{children ?? "—"}</p>
  </div>
);

/**
 * Read-only modal for a Category Type. `data` is the row object from the list.
 */
const CategoryTypeView = ({ data, onClose }) => (
  <div className="cat-modal-overlay" onClick={onClose}>
    <div className="cat-modal" onClick={(e) => e.stopPropagation()}>
      <div className="cat-modal-header">
        <h3>Category Type Details</h3>
        <button type="button" className="cat-modal-close" onClick={onClose}>
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div className="cat-modal-body">
        <div className="cat-view-grid">
          <Field label="Category Type Name">{data?.name}</Field>
          <Field label="Code">{data?.code}</Field>
          <Field label="Status">
            <span className={`cat-badge ${data?.is_active ? "active" : "inactive"}`}>
              {data?.is_active ? "Active" : "Inactive"}
            </span>
          </Field>
          <Field label="Description" full>
            {data?.description}
          </Field>
          <Field label="Created By">{data?.created_by_name}</Field>
          <Field label="Created At">{formatDateTime(data?.created_at)}</Field>
          <Field label="Updated By">{data?.updated_by_name}</Field>
          <Field label="Updated At">{formatDateTime(data?.updated_at)}</Field>
        </div>
      </div>

      <div className="cat-modal-footer">
        <button type="button" className="cat-btn cat-btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  </div>
);

export default CategoryTypeView;