import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getFeatures,
  getAvailabilityTypes,
  updateFeature,
} from "../../services/roleFeatureService.js";
import { getApiErrorMessage } from "../../services/errorMessage.js";
import { useRBAC } from "../../shared/component/RBACProvider.jsx";
import ToastMessage from "../../shared/component/ToastMessage.jsx";
import "./FeatureAvailabilityMapList.css";
import { FaProjectDiagram, FaPuzzlePiece, FaCheckCircle, FaMinusCircle, FaSearch, FaTimes, FaCheck, FaChevronLeft, FaChevronRight, FaChevronUp, FaChevronDown } from "react-icons/fa";

const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";
const ACCENT = "#1a709b";

const FeatureAvailabilityMapList = () => {
  const { can, loading: rbacLoading } = useRBAC();
  const [features, setFeatures] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState(new Set());
  const [toast, setToast] = useState(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("feature_name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [pagination, setPagination] = useState(null);

  const canUpdate = can(["features", "feature"], "update");

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, limit, sortField, sortOrder]);

  const fetchData = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = {
        page: p,
        limit,
        search: debouncedSearch || undefined,
        is_deleted: false,
        sort: `${sortField}:${sortOrder}`,
      };
      if (statusFilter !== "all") params.is_active = statusFilter === "active";

      const [featureRes, typeData] = await Promise.all([
        getFeatures(params),
        getAvailabilityTypes(),
      ]);
      setFeatures(Array.isArray(featureRes.rows) ? featureRes.rows : []);
      setPagination(featureRes.pagination || null);
      setTypes(Array.isArray(typeData) ? typeData : []);
      setPage(p);
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to load data."), "danger");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, sortField, sortOrder]);

  useEffect(() => { fetchData(1); }, [debouncedSearch, statusFilter, limit, sortField, sortOrder]);
  useEffect(() => { fetchData(page); }, [page]);

  const getCurrentTypeIds = useCallback((feature) => {
    if (Array.isArray(feature.availability_types)) {
      return feature.availability_types.map((t) => t.availability_type_id);
    }
    return [];
  }, []);

  const handleToggle = async (feature, typeId) => {
    if (!canUpdate) {
      showToast("You do not have permission to update features.", "danger");
      return;
    }
    if (savingIds.has(feature.feature_id)) return;

    const currentIds = getCurrentTypeIds(feature);
    const nextIds = currentIds.includes(typeId)
      ? currentIds.filter((id) => id !== typeId)
      : [...currentIds, typeId];

    setSavingIds((prev) => new Set(prev).add(feature.feature_id));
    try {
      await updateFeature(feature.feature_id, { availability_type_ids: nextIds });
      setFeatures((prev) =>
        prev.map((f) =>
          f.feature_id === feature.feature_id
            ? { ...f, availability_types: types.filter((t) => nextIds.includes(t.availability_type_id)) }
            : f
        )
      );
    } catch (error) {
      showToast(getApiErrorMessage(error, `Failed to update '${feature.feature_name}'.`), "danger");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(feature.feature_id);
        return next;
      });
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const stats = useMemo(() => {
    const assigned = features.filter((f) => getCurrentTypeIds(f).length > 0);
    return {
      total: pagination?.total || features.length,
      totalAssigned: assigned.length,
      totalUnassigned: features.length - assigned.length,
    };
  }, [features, pagination, getCurrentTypeIds]);

  const totalPages = pagination
    ? pagination.totalPages || Math.ceil((pagination.total || 0) / limit)
    : 1;

  if (rbacLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
        <div className="spinner-border" style={{ color: ACCENT }} role="status" />
      </div>
    );
  }

  return (
    <div className="hc-fam-container">
      <ToastMessage toast={toast} />

      <div className="hc-fam-hero">
        <div className="hc-fam-hero-content">
          <span className="hc-fam-badge">Feature Assignment Matrix</span>
          <h4 className="hc-fam-title">
            <FaProjectDiagram className="me-2" />Feature — Availability Map
          </h4>
          <p className="hc-fam-subtitle">
            Assign availability types (REACT, ANGULAR, etc.) to features. Toggle a checkbox to add or remove the assignment — changes save immediately.
          </p>
        </div>
        <div className="hc-fam-hero-right">
          <span className="hc-fam-chip"><FaPuzzlePiece className="me-1" />{stats.total} features</span>
          <span className="hc-fam-chip"><FaCheckCircle className="me-1" />{stats.totalAssigned} assigned</span>
          <span className="hc-fam-chip"><FaMinusCircle className="me-1" />{stats.totalUnassigned} unassigned</span>
        </div>
      </div>

      <div className="hc-fam-card">
        <div className="hc-fam-toolbar">
          <div className="hc-fam-search-wrap">
            <FaSearch className="hc-fam-search-icon" />
            <input
              type="text"
              className="hc-fam-search-input"
              placeholder="Search features..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="hc-fam-search-clear" onClick={() => setSearch("")}>
                <FaTimes />
              </button>
            )}
          </div>
          <div className="hc-fam-toolbar-right">
            <select
              className="hc-fam-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              className="hc-fam-select"
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

        <div className="hc-fam-table-wrap">
          {loading ? (
            <div className="hc-fam-loading">
              <div className="spinner-border" style={{ color: ACCENT }} role="status" />
              <p className="text-muted mt-2 small mb-0">Loading features & availability types...</p>
            </div>
          ) : features.length === 0 ? (
            <div className="hc-fam-empty">
              <FaPuzzlePiece className="fs-1 text-muted opacity-50" />
              <p className="text-muted mt-2 mb-0">No features found.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="hc-fam-table">
                <thead>
                  <tr>
                    <th
                      className="hc-fam-th hc-fam-th-name hc-fam-th-sortable"
                      onClick={() => handleSort("feature_name")}
                    >
                      Feature
                      {sortField === "feature_name" && (sortOrder === "asc" ? <FaChevronUp className="ms-1" /> : <FaChevronDown className="ms-1" />)}
                    </th>
                    {types.map((type) => (
                      <th key={type.availability_type_id} className="hc-fam-th hc-fam-th-type">
                        <span className="hc-fam-type-label">{type.code}</span>
                        <span className="hc-fam-type-sub">{type.name}</span>
                      </th>
                    ))}
                    <th
                      className="hc-fam-th hc-fam-th-status hc-fam-th-sortable"
                      onClick={() => handleSort("is_active")}
                    >
                      Status
                      {sortField === "is_active" && (sortOrder === "asc" ? <FaChevronUp className="ms-1" /> : <FaChevronDown className="ms-1" />)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature) => {
                    const typeIds = getCurrentTypeIds(feature);
                    const isSaving = savingIds.has(feature.feature_id);
                    return (
                      <tr key={feature.feature_id} className="hc-fam-tr">
                        <td className="hc-fam-td hc-fam-td-name">
                          <div className="hc-fam-feature-info">
                            <span className="hc-fam-feature-name">{feature.feature_name}</span>
                            <span className="hc-fam-feature-meta">ID #{feature.feature_id}{feature.category_name ? ` · ${feature.category_name}` : ""}</span>
                          </div>
                        </td>
                        {types.map((type) => {
                          const checked = typeIds.includes(type.availability_type_id);
                          return (
                            <td key={type.availability_type_id} className="hc-fam-td hc-fam-td-check">
                              <label className={`hc-fam-check-label${checked ? " is-checked" : ""}`}>
                                <input
                                  type="checkbox"
                                  className="hc-fam-check-input"
                                  checked={checked}
                                  disabled={isSaving || !canUpdate}
                                  onChange={() => handleToggle(feature, type.availability_type_id)}
                                />
                                <span className="hc-fam-check-visual">
                                  {checked ? <FaCheck /> : null}
                                </span>
                              </label>
                            </td>
                          );
                        })}
                        <td className="hc-fam-td hc-fam-td-status">
                          {isSaving ? (
                            <span className="spinner-border spinner-border-sm" style={{ color: ACCENT }} role="status" />
                          ) : (
                            <span className={`hc-fam-status-dot${feature.is_active !== false ? " is-active" : ""}`} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="hc-fam-pagination">
            <small className="text-muted">
              Page {page} of {totalPages}
              {pagination?.total ? ` · ${pagination.total} total` : ""}
            </small>
            <div className="hc-fam-pagination-btns">
              <button
                className="hc-fam-page-btn"
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
                    className={`hc-fam-page-btn${p === page ? " is-active" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                className="hc-fam-page-btn"
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

export default FeatureAvailabilityMapList;
