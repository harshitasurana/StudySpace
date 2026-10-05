import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getAvailabilityTypes,
  createAvailabilityType,
  updateAvailabilityType,
  deleteAvailabilityType,
} from "../../services/roleFeatureService.js";
import { getApiErrorMessage } from "../../services/errorMessage.js";
import { useRBAC } from "../../shared/component/RBACProvider.jsx";
import ToastMessage from "../../shared/component/ToastMessage.jsx";
import FeatureAvailabilityForm from "./FeatureAvailabilityForm.jsx";
import { FaThLarge, FaPlus, FaSearch, FaTimes, FaPencilAlt, FaTrash, FaChevronLeft, FaChevronRight, FaCheckCircle, FaMinusCircle, FaChevronUp, FaChevronDown } from "react-icons/fa";

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
    <i className={`bi ${active ? "bi-check-circle-fill" : "bi-dash-circle-fill"} me-1`} />
    {active ? "Active" : "Inactive"}
  </span>
);

const FeatureAvailabilityList = () => {
  const { can, loading: rbacLoading } = useRBAC();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentType, setCurrentType] = useState(null);
  const [toast, setToast] = useState(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("display_order");
  const [sortOrder, setSortOrder] = useState("asc");

  const canCreate = can(["features", "feature"], "create");
  const canUpdate = can(["features", "feature"], "update");
  const canDelete = can(["features", "feature"], "delete");

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, limit, sortField, sortOrder]);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAvailabilityTypes();
      setTypes(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast("Failed to load availability types.", "danger");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filtered = useMemo(() => {
    let result = [...types];

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      result = result.filter((t) => t.is_active === isActive);
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (t) =>
          (t.code || "").toLowerCase().includes(q) ||
          (t.name || "").toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [types, statusFilter, debouncedSearch, sortField, sortOrder]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  const activeCount = useMemo(
    () => types.filter((t) => t.is_active).length,
    [types]
  );
  const inactiveCount = useMemo(
    () => types.filter((t) => !t.is_active).length,
    [types]
  );

  const openCreate = () => {
    setCurrentType(null);
    setIsEditing(false);
    setShowForm(true);
  };

  const openEdit = (type) => {
    if (!canUpdate) {
      showToast("You do not have permission to update availability types.", "danger");
      return;
    }
    setCurrentType(type);
    setIsEditing(true);
    setShowForm(true);
  };

  const closeForm = () => {
    if (saveLoading) return;
    setShowForm(false);
    setCurrentType(null);
    setIsEditing(false);
  };

  const handleSave = async (payload) => {
    const isEdit = isEditing && currentType?.availability_type_id;

    if (!isEdit && !canCreate) {
      showToast("You do not have permission to create availability types.", "danger");
      return;
    }

    setSaveLoading(true);
    try {
      if (isEdit) {
        const { code, ...updates } = payload;
        await updateAvailabilityType(currentType.availability_type_id, updates);
        showToast("Availability type updated successfully.");
      } else {
        await createAvailabilityType(payload);
        showToast("Availability type created successfully.");
      }
      closeForm();
      fetchTypes();
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to save availability type."), "danger");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (type) => {
    if (!canDelete) {
      showToast("You do not have permission to delete availability types.", "danger");
      return;
    }
    if (!type?.availability_type_id) return;
    if (!window.confirm(`Delete availability type '${type.name}' (${type.code})?`)) return;

    setDeleteLoadingId(type.availability_type_id);
    try {
      await deleteAvailabilityType(type.availability_type_id);
      showToast("Availability type deleted.");
      fetchTypes();
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to delete availability type."), "danger");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  if (rbacLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border" style={{ color: "#1a709b" }}></div>
      </div>
    );
  }

  return (
    <div className="p-3 p-md-4">
      <ToastMessage toast={toast} />

      <div
        className="d-flex justify-content-between align-items-start gap-3 mb-4 flex-wrap p-3 p-md-4"
        style={{
          borderRadius: 16,
          background: "linear-gradient(145deg, #ffffff 0%, #f7fbff 100%)",
          border: "1px solid #e8f0f7",
          boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
        }}
      >
        <div>
          <span
            className="badge rounded-pill mb-2"
            style={{ background: "rgba(26,112,155,0.1)", color: "#1a709b", fontWeight: 600 }}
          >
            Feature Availability Management
          </span>
          <h4 className="fw-bold mb-1" style={{ color: "#0d3a5c" }}>
            <FaThLarge className="me-2" />Availability Types
          </h4>
          <p className="text-muted small mb-0">Manage the availability type definitions used by features.</p>
        </div>

        {canCreate && (
          <button className="btn rounded-3 px-3" style={{ background: "#1a709b", border: "none", color: "#fff" }} onClick={openCreate}>
            <FaPlus className="me-2" />New Type
          </button>
        )}
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 14 }}>
            <div className="card-body p-3">
              <p className="text-muted small mb-2">Active</p>
              <h3 className="fw-bold mb-0" style={{ color: "#16a34a" }}>{activeCount}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 14 }}>
            <div className="card-body p-3">
              <p className="text-muted small mb-2">Inactive</p>
              <h3 className="fw-bold mb-0" style={{ color: "#64748b" }}>{inactiveCount}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 14 }}>
            <div className="card-body p-3">
              <p className="text-muted small mb-2">Total</p>
              <h3 className="fw-bold mb-0" style={{ color: "#1a709b" }}>{types.length}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 rounded-3 mb-4" style={{ boxShadow: "0 12px 24px rgba(15,23,42,0.06)" }}>
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            <div className="col-md-5">
              <div className="input-group" style={{ border: "1.5px solid #e2e8f0", borderRadius: 12, background: "#f8fafc" }}>
                <span className="input-group-text border-0" style={{ background: "#f8fafc" }}>
                  <FaSearch className="text-muted" />
                </span>
                <input
                  type="text"
                  className="form-control border-0"
                  style={{ background: "#f8fafc" }}
                  placeholder="Search by code, name, or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="btn border-0" style={{ background: "#f8fafc" }} onClick={() => setSearch("")}>
                    <FaTimes className="text-muted" />
                  </button>
                )}
              </div>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                style={{ borderRadius: 12, minHeight: 48 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                style={{ borderRadius: 12, minHeight: 48 }}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={10}>10 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={500}>500 / page</option>
              </select>
            </div>
            <div className="col-md-2 text-md-end">
              <span className="text-muted small">
                Showing <strong>{paginated.length}</strong> of <strong>{totalItems}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table mb-0 align-middle">
              <thead className="bg-light">
                <tr>
                  <th className="hc-fam-th-sortable" style={{ cursor: "pointer" }} onClick={() => handleSort("code")}>
                    Code
                    {sortField === "code" && (sortOrder === "asc" ? <FaChevronUp className="ms-1" /> : <FaChevronDown className="ms-1" />)}
                  </th>
                  <th className="hc-fam-th-sortable" style={{ cursor: "pointer" }} onClick={() => handleSort("name")}>
                    Name
                    {sortField === "name" && (sortOrder === "asc" ? <FaChevronUp className="ms-1" /> : <FaChevronDown className="ms-1" />)}
                  </th>
                  <th>Description</th>
                  <th className="hc-fam-th-sortable" style={{ cursor: "pointer", width: 80 }} onClick={() => handleSort("display_order")}>
                    Order
                    {sortField === "display_order" && (sortOrder === "asc" ? <FaChevronUp className="ms-1" /> : <FaChevronDown className="ms-1" />)}
                  </th>
                  <th className="hc-fam-th-sortable" style={{ cursor: "pointer", width: 110 }} onClick={() => handleSort("is_active")}>
                    Status
                    {sortField === "is_active" && (sortOrder === "asc" ? <FaChevronUp className="ms-1" /> : <FaChevronDown className="ms-1" />)}
                  </th>
                  <th className="text-end" style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4">
                      <div className="spinner-border text-primary" role="status" />
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">
                      No availability types found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((t) => (
                    <tr key={t.availability_type_id}>
                      <td>
                        <span
                          className="badge rounded-pill px-3 py-2"
                          style={{
                            background: "rgba(26,112,155,0.1)",
                            color: "#1a709b",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            fontFamily: "monospace",
                          }}
                        >
                          {t.code}
                        </span>
                      </td>
                      <td className="fw-semibold">{t.name}</td>
                      <td>{t.description || "-"}</td>
                      <td>{t.display_order}</td>
                      <td><StatusBadge active={t.is_active} /></td>
                      <td className="text-end">
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => openEdit(t)}
                            disabled={!canUpdate}
                            title="Edit"
                          >
                            <FaPencilAlt />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(t)}
                            disabled={!canDelete || deleteLoadingId === t.availability_type_id}
                            title="Delete"
                          >
                            {deleteLoadingId === t.availability_type_id ? (
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                            ) : (
                              <FaTrash />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center px-4 py-3 border-top">
            <small className="text-muted">
              Page {page} of {totalPages} &middot; {totalItems} total
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
                    className={`btn btn-sm rounded-3 border${p === page ? " text-white" : ""}`}
                    style={p === page ? { background: "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)", border: "none" } : {}}
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

      {showForm && (
        <FeatureAvailabilityForm
          type={currentType}
          onSave={handleSave}
          onCancel={closeForm}
          isEditing={isEditing}
          isLoading={saveLoading}
        />
      )}
    </div>
  );
};

export default FeatureAvailabilityList;
