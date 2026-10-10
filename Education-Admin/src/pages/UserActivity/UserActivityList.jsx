import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaUserClock,
  FaSearch,
  FaTimes,
  FaCircle,
  FaArrowLeft,
  FaClock,
  FaFire,
  FaListUl,
  FaSyncAlt,
} from "react-icons/fa";
import { getUserActivityList, getUserActivityDetail } from "../../services/userActivityService.js";
import { getApiErrorMessage } from "../../services/errorMessage.js";

const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";

// Same gap-based session convention the backend uses (see
// user_activity_service.js) — surfaced here only for the "Online now" dot
// tooltip, not recomputed client-side.
const ONLINE_WITHIN_MINUTES = 5;

const WINDOW_OPTIONS = [
  { value: 1, label: "Today" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

// "Estimated" throughout this screen because it's derived from real API
// request timestamps (gap-based session detection — a >30min gap between
// two requests ends a visit), not a client-side heartbeat/tab-visibility
// signal. Close enough to answer "when/how much," not billing-grade.
const formatDuration = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return "—";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatRelative = (isoString) => {
  if (!isoString) return "Never";
  const then = new Date(isoString).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const formatDateTime = (isoString) =>
  new Date(isoString).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const OnlineDot = ({ online }) => (
  <span
    title={online ? `Active within the last ${ONLINE_WITHIN_MINUTES} minutes` : "Offline"}
    style={{
      display: "inline-block",
      width: 9,
      height: 9,
      borderRadius: "50%",
      background: online ? "#16a34a" : "#cbd5e1",
      boxShadow: online ? "0 0 0 3px rgba(22,163,74,0.18)" : "none",
    }}
  />
);

// ─── Detail / drill-down view ───────────────────────────────────────────────

const DailyBarChart = ({ daily }) => {
  const max = Math.max(1, ...daily.map((d) => d.active_seconds));
  return (
    <div className="d-flex align-items-end gap-2" style={{ height: 120 }}>
      {daily.map((d) => (
        <div key={d.date} className="d-flex flex-column align-items-center flex-fill" style={{ minWidth: 0 }}>
          <div
            title={`${formatDuration(d.active_seconds)} · ${d.sessions_count} session${d.sessions_count === 1 ? "" : "s"}`}
            style={{
              width: "100%",
              maxWidth: 28,
              height: Math.max(4, Math.round((d.active_seconds / max) * 90)),
              background: BRAND,
              borderRadius: "4px 4px 0 0",
            }}
          />
          <span className="text-muted mt-1" style={{ fontSize: "0.65rem" }}>
            {new Date(d.date).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
          </span>
        </div>
      ))}
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value, sub }) => (
  <div className="bg-white rounded-3 border p-3 flex-fill d-flex align-items-center gap-3" style={{ minWidth: 160 }}>
    <div
      className="d-flex align-items-center justify-content-center rounded-3"
      style={{ width: 40, height: 40, background: "rgba(26,112,155,0.1)", color: "#1a709b" }}
    >
      <Icon />
    </div>
    <div>
      <div className="text-muted small">{label}</div>
      <div className="fw-bold" style={{ color: "#0d3a5c" }}>{value}</div>
      {sub && <div className="text-muted" style={{ fontSize: "0.72rem" }}>{sub}</div>}
    </div>
  </div>
);

// School/board/class only render when present — a non-student user (any
// other role) simply has none of these, not blanks.
const subtitleFor = (u) => {
  const parts = [u.email];
  if (u.role_name) parts.push(u.role_name);
  if (u.school_name) parts.push(u.school_name);
  if (u.board_name) parts.push(u.class_name ? `${u.board_name} · Class ${u.class_name}` : u.board_name);
  return parts.filter(Boolean).join(" · ");
};

const UserActivityDetailView = ({ userId, days, onBack }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getUserActivityDetail(userId, { days })
      .then((data) => { if (!cancelled) setDetail(data); })
      .catch((err) => { if (!cancelled) setError(getApiErrorMessage(err, "Failed to load activity detail.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, days]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" style={{ color: "#1a709b" }} />
      </div>
    );
  }
  if (error || !detail) {
    return <div className="alert alert-danger">{error || "Not found."}</div>;
  }

  const { user, summary, daily_breakdown: daily, sessions } = detail;

  return (
    <div>
      <button className="btn btn-sm btn-outline-secondary rounded-3 mb-3 d-flex align-items-center gap-2" onClick={onBack}>
        <FaArrowLeft /> Back to all users
      </button>

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h5 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: "#0d3a5c" }}>
            <OnlineDot online={summary.is_online} />
            {user.name}
          </h5>
          <p className="text-muted small mb-0">{subtitleFor(user)}</p>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-3 mb-4">
        <SummaryCard icon={FaCircle} label="Status" value={summary.is_online ? "Online now" : "Offline"} sub={`Last seen ${formatRelative(summary.last_active_at)}`} />
        <SummaryCard icon={FaClock} label={`Est. time (${summary.window_days}d)`} value={formatDuration(summary.active_seconds)} sub="From activity gaps, not exact" />
        <SummaryCard icon={FaFire} label="Sessions" value={summary.sessions_count} sub={`${summary.action_count.toLocaleString()} actions`} />
      </div>

      {daily.length > 0 && (
        <div className="bg-white rounded-3 border p-3 mb-4">
          <p className="fw-semibold small mb-3" style={{ color: "#0d3a5c" }}>Daily activity</p>
          <DailyBarChart daily={daily} />
        </div>
      )}

      <div className="bg-white rounded-3 border p-3">
        <p className="fw-semibold small mb-3" style={{ color: "#0d3a5c" }}>Activity timeline</p>
        {sessions.length === 0 ? (
          <p className="text-muted small mb-0">No activity in this window.</p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {sessions.map((session, idx) => (
              <div key={idx} className="border rounded-3 p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-semibold small" style={{ color: "#0d3a5c" }}>
                    {formatDateTime(session.start)} – {formatDateTime(session.end)}
                  </span>
                  <span className="badge rounded-pill" style={{ background: "rgba(26,112,155,0.1)", color: "#1a709b" }}>
                    {formatDuration(session.duration_seconds)} · {session.entries.length} action{session.entries.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="d-flex flex-column gap-1" style={{ maxHeight: 220, overflowY: "auto" }}>
                  {session.entries.map((entry) => (
                    <div key={entry.audit_id} className="d-flex justify-content-between small">
                      <span className="text-body">{entry.label}</span>
                      <span className="text-muted">{new Date(entry.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── List view ───────────────────────────────────────────────────────────────

const SortHeader = ({ label, field, sortBy, sortOrder, onSort, className = "" }) => (
  <th
    className={`py-3 fw-semibold small ${className}`}
    style={{ color: "#64748b", cursor: "pointer", userSelect: "none" }}
    onClick={() => onSort(field)}
  >
    {label}
    {sortBy === field && <span className="ms-1">{sortOrder === "asc" ? "▲" : "▼"}</span>}
  </th>
);

const UserActivityList = () => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState(7);
  const [sortBy, setSortBy] = useState("last_active_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const limit = 20;

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUserActivityList({ search: search || undefined, page, limit, sortBy, sortOrder, days });
      setItems(data?.items || []);
      setTotal(data?.total || 0);
      setTotalPages(data?.totalPages || 1);
      setError("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load user activity."));
    } finally {
      setLoading(false);
    }
  }, [search, page, sortBy, sortOrder, days]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const onlineCount = useMemo(() => items.filter((i) => i.is_online).length, [items]);

  if (selectedUserId) {
    return (
      <div className="container-fluid py-4 px-3 px-md-4">
        <UserActivityDetailView userId={selectedUserId} days={days} onBack={() => setSelectedUserId(null)} />
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* Header */}
      <div className="rounded-4 mb-4 p-4 text-white position-relative" style={{ background: BRAND }}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h4 className="fw-bold mb-1">
              <FaUserClock className="me-2" />
              User Activity
            </h4>
            <p className="mb-0 opacity-75 small">
              Who's signing in, what they're doing, and an estimate of how long — derived from real request activity, updated live. Covers every role in your organization.
            </p>
          </div>
          <button type="button" className="btn btn-outline-light rounded-3 px-3 d-flex align-items-center gap-2 fw-semibold" onClick={fetchList}>
            <FaSyncAlt />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card border-0 rounded-4 mb-4 shadow-sm">
        <div className="card-body py-3 px-4">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-6">
              <div className="input-group rounded-3 overflow-hidden">
                <span className="input-group-text bg-white border-0 text-muted"><FaSearch /></span>
                <input
                  className="form-control border-0 shadow-none"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                />
                {search && (
                  <button className="btn btn-link text-muted border-0 px-2" onClick={() => { setPage(1); setSearch(""); }}>
                    <FaTimes />
                  </button>
                )}
              </div>
            </div>
            <div className="col-12 col-md-6">
              <select
                className="form-select rounded-3"
                value={days}
                onChange={(e) => { setPage(1); setDays(Number(e.target.value)); }}
              >
                {WINDOW_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="d-flex flex-wrap gap-3 mb-4">
        <SummaryCard icon={FaListUl} label="Users shown" value={total} />
        <SummaryCard icon={FaCircle} label="Online now" value={onlineCount} sub={`of ${items.length} on this page`} />
      </div>

      {/* Table */}
      <div className="card border-0 rounded-4 shadow-sm">
        {error ? (
          <div className="text-center py-5">
            <p className="text-danger mb-0">{error}</p>
          </div>
        ) : loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color: "#1a709b" }} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-5">
            <FaUserClock className="fs-1 text-muted opacity-40" />
            <p className="text-muted mt-2">No users found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <SortHeader label="User" field="name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-4" />
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Role / Details</th>
                  <SortHeader label="Last Active" field="last_active_at" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortHeader label="Sessions" field="sessions_count" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortHeader label="Est. Time" field="active_seconds" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortHeader label="Actions" field="action_count" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <th className="py-3 fw-semibold small text-end pe-4" style={{ color: "#64748b" }} />
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.user_id} style={{ cursor: "pointer" }} onClick={() => setSelectedUserId(u.user_id)}>
                    <td className="px-4">
                      <div className="d-flex align-items-center gap-2">
                        <OnlineDot online={u.is_online} />
                        <div>
                          <div className="fw-semibold" style={{ color: "#1e293b" }}>{u.name}</div>
                          <div className="text-muted" style={{ fontSize: "0.78rem" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted small">
                      {u.role_name || "—"}
                      {u.school_name && <div style={{ fontSize: "0.78rem" }}>{u.school_name}</div>}
                      {u.class_name && <div style={{ fontSize: "0.78rem" }}>{u.board_name} · Class {u.class_name}</div>}
                    </td>
                    <td className="text-muted small">{formatRelative(u.last_active_at)}</td>
                    <td className="text-muted small">{u.sessions_count || "—"}</td>
                    <td className="text-muted small">{formatDuration(u.active_seconds)}</td>
                    <td className="text-muted small">{u.action_count ? u.action_count.toLocaleString() : "—"}</td>
                    <td className="text-end pe-4">
                      <button
                        className="btn btn-sm btn-light rounded-3"
                        onClick={(e) => { e.stopPropagation(); setSelectedUserId(u.user_id); }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center px-4 py-3 border-top">
            <span className="text-muted small">Page {page} of {totalPages}</span>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary rounded-3" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button className="btn btn-sm btn-outline-secondary rounded-3" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserActivityList;
