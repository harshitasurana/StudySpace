import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as categoryService from "../../../services/categoryService.js";
import CategoryListForm from "./CategoryListForm.jsx";
import CategoryListView from "./CategoryListView.jsx";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getTypeName = (category) =>
  category?.CategoryType?.name || category?.category_type?.name || "—";

const getTypeCode = (category) =>
  category?.CategoryType?.code || category?.category_type?.code || "";

const CategoryList = () => {
  const [categories, setCategories] = useState([]);
  const [categoryTypes, setCategoryTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typesLoading, setTypesLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("grid");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create"); // 'create' | 'edit'
  const [formInitialData, setFormInitialData] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formSaving, setFormSaving] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadCategoryTypes = useCallback(async () => {
    setTypesLoading(true);
    try {
      const data = await categoryService.getCategoryTypes();
      setCategoryTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to load category types");
    } finally {
      setTypesLoading(false);
    }
  }, [showToast]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = typeFilter ? { type: typeFilter } : {};
      const data = await categoryService.getCategories(params);
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    loadCategoryTypes();
  }, [loadCategoryTypes]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, statusFilter, pageSize]);

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return categories.filter((category) => {
      if (term) {
        const name = (category.name || "").toLowerCase();
        const code = (category.code || "").toLowerCase();
        if (!name.includes(term) && !code.includes(term)) return false;
      }
      if (statusFilter === "active" && !category.is_active) return false;
      if (statusFilter === "inactive" && category.is_active) return false;
      return true;
    });
  }, [categories, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCategories = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredCategories.slice(start, start + pageSize);
  }, [filteredCategories, safePage, pageSize]);

  /* ------------------------------- Create ------------------------------- */

  const openCreate = () => {
    setFormMode("create");
    setFormInitialData(null);
    setFormOpen(true);
  };

  /* -------------------------------- Edit --------------------------------- */

  const openEdit = async (category) => {
    setFormMode("edit");
    setFormOpen(true);
    setFormLoading(true);
    try {
      const full = await categoryService.getCategoryById(category.category_id);
      setFormInitialData(full);
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to load category");
      setFormOpen(false);
    } finally {
      setFormLoading(false);
    }
  };

  const handleFormSubmit = async (payload) => {
    setFormSaving(true);
    try {
      if (formMode === "create") {
        await categoryService.createCategory(payload);
        showToast("success", "Category created successfully");
      } else {
        await categoryService.updateCategory(formInitialData.category_id, payload);
        showToast("success", "Category updated successfully");
      }
      setFormOpen(false);
      await loadCategories();
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to save category");
    } finally {
      setFormSaving(false);
    }
  };

  /* -------------------------------- View --------------------------------- */

  const openView = async (category) => {
    setViewOpen(true);
    setViewLoading(true);
    setViewData(null);
    try {
      const full = await categoryService.getCategoryById(category.category_id);
      setViewData(full);
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to load category");
      setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  /* ------------------------------- Delete --------------------------------- */

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await categoryService.deleteCategory(deleteTarget.category_id);
      showToast("success", "Category deleted successfully");
      setDeleteTarget(null);
      await loadCategories();
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to delete category");
    } finally {
      setDeleting(false);
    }
  };

  /* -------------------------------- Render -------------------------------- */

  return (
    <div>
      <div className="cat-header">
        <div>
          <h2 className="cat-header-title">
            Category Management
          </h2>
          <p className="cat-header-subtitle">Manage application categories</p>
        </div>
        <button type="button" className="cat-btn cat-btn-primary" onClick={openCreate}>
          <i className="bi bi-plus-lg" />
          New Category
        </button>
      </div>

      <div className="cat-toolbar">
        <div className="cat-search">
          <i className="bi bi-search" />
          <input
            type="text"
            placeholder="Search Categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="cat-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          disabled={typesLoading}
        >
          <option value="">All Category Types</option>
          {categoryTypes.map((type) => (
            <option key={type.category_type_id} value={type.code}>
              {type.name}
            </option>
          ))}
        </select>

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
          <p>Loading categories…</p>
        </div>
      )}

      {!loading && error && (
        <div className="cat-state error">
          <i className="bi bi-exclamation-triangle" />
          <p>{error}</p>
          <button type="button" className="cat-btn cat-btn-secondary" onClick={loadCategories}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && filteredCategories.length === 0 && (
        <div className="cat-state">
          <i className="bi bi-inbox" />
          <p>No categories found. Try adjusting your search or filters.</p>
        </div>
      )}

      {!loading && !error && filteredCategories.length > 0 && viewMode === "grid" && (
        <div className="cat-grid">
          {paginatedCategories.map((category) => (
            <div className="cat-card" key={category.category_id}>
              <div className="cat-card-top">
                <div>
                  <h3 className="cat-card-title">{category.name}</h3>
                  <span className="cat-card-type">{getTypeName(category)}</span>
                </div>
                <span className={`cat-badge ${category.is_active ? "active" : "inactive"}`}>
                  {category.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              {category.description && (
                <p className="cat-card-desc">{category.description}</p>
              )}

              <div className="cat-card-meta">
                <div>
                  Category ID <br />
                  <span>{category.category_id}</span>
                </div>
                <div>
                  Code <br />
                  <span>{category.code || "—"}</span>
                </div>
                <div>
                  Display Order <br />
                  <span>{category.display_order ?? 0}</span>
                </div>
                <div>
                  Updated <br />
                  <span>{formatDate(category.updated_at)}</span>
                </div>
              </div>

              <div className="cat-card-footer">
                <span />
                <div className="cat-card-actions">
                  <button
                    type="button"
                    className="cat-icon-btn"
                    title="View"
                    onClick={() => openView(category)}
                  >
                    <i className="bi bi-eye" />
                  </button>
                  <button
                    type="button"
                    className="cat-icon-btn"
                    title="Edit"
                    onClick={() => openEdit(category)}
                  >
                    <i className="bi bi-pencil" />
                  </button>
                  <button
                    type="button"
                    className="cat-icon-btn danger"
                    title="Delete"
                    onClick={() => setDeleteTarget(category)}
                  >
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filteredCategories.length > 0 && viewMode === "table" && (
        <div className="cat-table-wrap">
          <table className="cat-table">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Category Type</th>
                <th>Code</th>
                <th>Display Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCategories.map((category) => (
                <tr key={category.category_id}>
                  <td>{category.name}</td>
                  <td>{getTypeName(category)}</td>
                  <td>{category.code || "—"}</td>
                  <td>{category.display_order ?? 0}</td>
                  <td>
                    <span className={`cat-badge ${category.is_active ? "active" : "inactive"}`}>
                      {category.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="cat-table-actions">
                      <button
                        type="button"
                        className="cat-icon-btn"
                        title="View"
                        onClick={() => openView(category)}
                      >
                        <i className="bi bi-eye" />
                      </button>
                      <button
                        type="button"
                        className="cat-icon-btn"
                        title="Edit"
                        onClick={() => openEdit(category)}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        type="button"
                        className="cat-icon-btn danger"
                        title="Delete"
                        onClick={() => setDeleteTarget(category)}
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

      {!loading && !error && filteredCategories.length > 0 && (
        <div className="cat-pagination">
          <span>
            Showing {(safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, filteredCategories.length)} of{" "}
            {filteredCategories.length} categories
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
        <CategoryListForm
          mode={formMode}
          initialData={formInitialData}
          categoryTypes={categoryTypes}
          loading={formLoading}
          saving={formSaving}
          onSubmit={handleFormSubmit}
          onClose={() => setFormOpen(false)}
        />
      )}

      {viewOpen && (
        <CategoryListView
          data={viewData}
          loading={viewLoading}
          onClose={() => setViewOpen(false)}
        />
      )}

      {deleteTarget && (
        <div className="cat-modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="cat-modal cat-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="cat-modal-header">
              <h3>Delete Category?</h3>
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
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This
                action cannot be undone.
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

export default CategoryList;