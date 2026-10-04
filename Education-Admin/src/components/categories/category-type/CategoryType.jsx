import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as categoryService from "../../../services/categoryService.js";
import CategoryTypeForm from "./CategoryTypeForm.jsx";
import CategoryTypeView from "./CategoryTypeView.jsx";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const CategoryType = () => {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("grid");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [formInitialData, setFormInitialData] = useState(null);
  const [formSaving, setFormSaving] = useState(false);

  const [viewData, setViewData] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await categoryService.getCategoryTypes();
      setTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load category types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

  const filteredTypes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return types.filter((type) => {
      if (term) {
        const name = (type.name || "").toLowerCase();
        const code = (type.code || "").toLowerCase();
        if (!name.includes(term) && !code.includes(term)) return false;
      }
      if (statusFilter === "active" && !type.is_active) return false;
      if (statusFilter === "inactive" && type.is_active) return false;
      return true;
    });
  }, [types, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTypes.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTypes = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredTypes.slice(start, start + pageSize);
  }, [filteredTypes, safePage, pageSize]);

  const openCreate = () => {
    setFormMode("create");
    setFormInitialData(null);
    setFormOpen(true);
  };

  const openEdit = (type) => {
    setFormMode("edit");
    setFormInitialData(type);
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload) => {
    setFormSaving(true);
    try {
      if (formMode === "create") {
        await categoryService.createCategoryType(payload);
        showToast("success", "Category type created successfully");
      } else {
        await categoryService.updateCategoryType(formInitialData.category_type_id, payload);
        showToast("success", "Category type updated successfully");
      }
      setFormOpen(false);
      await loadTypes();
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to save category type");
    } finally {
      setFormSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await categoryService.deleteCategoryType(deleteTarget.category_type_id);
      showToast("success", "Category type deleted successfully");
      setDeleteTarget(null);
      await loadTypes();
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to delete category type");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="cat-header">
        <div>
          <h2 className="cat-header-title">
            Category Types
          </h2>
          <p className="cat-header-subtitle">Manage category master types</p>
        </div>
        <button type="button" className="cat-btn cat-btn-primary" onClick={openCreate}>
          <i className="bi bi-plus-lg" />
          New Category Type
        </button>
      </div>

      <div className="cat-toolbar">
        <div className="cat-search">
          <i className="bi bi-search" />
          <input
            type="text"
            placeholder="Search Category Types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="cat-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select
          className="cat-select"
          style={{ minWidth: 90 }}
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>

        <div className="cat-view-toggle">
          <button
            type="button"
            className={viewMode === "grid" ? "active" : ""}
            onClick={() => setViewMode("grid")}
          >
            <i className="bi bi-grid-3x3-gap" /> Grid
          </button>
          <button
            type="button"
            className={viewMode === "table" ? "active" : ""}
            onClick={() => setViewMode("table")}
          >
            <i className="bi bi-list-ul" /> Table
          </button>
        </div>
      </div>

      {loading && (
        <div className="cat-state">
          <div className="cat-spinner" />
          <p>Loading category types…</p>
        </div>
      )}

      {!loading && error && (
        <div className="cat-state error">
          <i className="bi bi-exclamation-triangle" />
          <p>{error}</p>
          <button type="button" className="cat-btn cat-btn-secondary" onClick={loadTypes}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && filteredTypes.length === 0 && (
        <div className="cat-state">
          <i className="bi bi-inbox" />
          <p>No category types found. Try adjusting your search or filters.</p>
        </div>
      )}

      {!loading && !error && filteredTypes.length > 0 && viewMode === "grid" && (
        <div className="cat-grid">
          {paginatedTypes.map((type) => (
            <div className="cat-card" key={type.category_type_id}>
              <div className="cat-card-top">
                <div>
                  <h3 className="cat-card-title">{type.name}</h3>
                  <span className="cat-card-type">{type.code}</span>
                </div>
                <span className={`cat-badge ${type.is_active ? "active" : "inactive"}`}>
                  {type.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              {type.description && <p className="cat-card-desc">{type.description}</p>}

              <div className="cat-card-footer">
                <span />
                <div className="cat-card-actions">
                  <button
                    type="button"
                    className="cat-icon-btn"
                    title="View"
                    onClick={() => setViewData(type)}
                  >
                    <i className="bi bi-eye" />
                  </button>
                  <button
                    type="button"
                    className="cat-icon-btn"
                    title="Edit"
                    onClick={() => openEdit(type)}
                  >
                    <i className="bi bi-pencil" />
                  </button>
                  <button
                    type="button"
                    className="cat-icon-btn danger"
                    title="Delete"
                    onClick={() => setDeleteTarget(type)}
                  >
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filteredTypes.length > 0 && viewMode === "table" && (
        <div className="cat-table-wrap">
          <table className="cat-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTypes.map((type) => (
                <tr key={type.category_type_id}>
                  <td>{type.name}</td>
                  <td>{type.code}</td>
                  <td>{type.description || "—"}</td>
                  <td>
                    <span className={`cat-badge ${type.is_active ? "active" : "inactive"}`}>
                      {type.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="cat-table-actions">
                      <button
                        type="button"
                        className="cat-icon-btn"
                        title="View"
                        onClick={() => setViewData(type)}
                      >
                        <i className="bi bi-eye" />
                      </button>
                      <button
                        type="button"
                        className="cat-icon-btn"
                        title="Edit"
                        onClick={() => openEdit(type)}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        type="button"
                        className="cat-icon-btn danger"
                        title="Delete"
                        onClick={() => setDeleteTarget(type)}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && filteredTypes.length > 0 && (
        <div className="cat-pagination">
          <span>
            Showing {(safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, filteredTypes.length)} of {filteredTypes.length}{" "}
            category types
          </span>
          <div className="cat-pagination-controls">
            <button
              type="button"
              className="cat-page-btn"
              disabled={safePage === 1}
              onClick={() => setCurrentPage(safePage - 1)}
            >
              <i className="bi bi-chevron-left" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "…" ? (
                  <span key={`ellipsis-${idx}`} style={{ padding: "0 4px" }}>
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`cat-page-btn ${p === safePage ? "active" : ""}`}
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              type="button"
              className="cat-page-btn"
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage(safePage + 1)}
            >
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        </div>
      )}

      {formOpen && (
        <CategoryTypeForm
          mode={formMode}
          initialData={formInitialData}
          saving={formSaving}
          onSubmit={handleFormSubmit}
          onClose={() => setFormOpen(false)}
        />
      )}

      {viewData && <CategoryTypeView data={viewData} onClose={() => setViewData(null)} />}

      {deleteTarget && (
        <div className="cat-modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="cat-modal cat-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="cat-modal-header">
              <h3>Delete Category Type?</h3>
              <button
                type="button"
                className="cat-modal-close"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="cat-modal-body">
              <p style={{ margin: 0, color: "#374151" }}>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>? Categories
                using this type will be unaffected, but this type will no longer be selectable.
              </p>
            </div>
            <div className="cat-modal-footer">
              <button
                type="button"
                className="cat-btn cat-btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cat-btn cat-btn-danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`cat-toast ${toast.type}`}>
          <i className={toast.type === "success" ? "bi bi-check-circle" : "bi bi-x-circle"} />
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default CategoryType;