import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getIngestionJobs,
  getChapterProcessingOverview,
  pauseIngestionJob,
  resumeIngestionJob,
  retryIngestionJob,
  processChapter,
  getSystemResources,
} from "../../services/curriculumService.js";
import { getApiErrorMessage } from "../../services/errorMessage.js";
import {
  FaSyncAlt,
  FaChevronDown,
  FaChevronRight,
  FaExclamationTriangle,
  FaListUl,
  FaLayerGroup,
  FaMicrochip,
  FaPauseCircle,
  FaPlayCircle,
  FaRedo,
} from "react-icons/fa";

const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";

// Same palette as CurriculumList.jsx's INGESTION_STATUS_STYLE — kept in
// sync by hand since this modal renders every job (not just latest-per-
// type) and needed its own copy rather than importing a non-exported
// const from that file.
const STATUS_STYLE = {
  pending: { bg: "rgba(100,116,139,0.14)", color: "#64748b", label: "Pending" },
  processing: { bg: "rgba(37,99,235,0.12)", color: "#2563eb", label: "Processing" },
  completed: { bg: "rgba(22,163,74,0.12)", color: "#16a34a", label: "Completed" },
  failed: { bg: "rgba(220,38,38,0.12)", color: "#dc2626", label: "Failed" },
  paused: { bg: "rgba(217,119,6,0.12)", color: "#d97706", label: "Paused" },
};

const JOB_TYPE_LABEL = { text: "Text", images: "Images", enrich: "Enrich" };

// All 6 pipeline stages a chapter can go through, in the order they'd
// naturally run — text/images first (need the PDF), enrich after images,
// mindmap/slidedeck/infographic last (need text). Drives both the
// chapter overview's column order and which handler a given stage's
// action button calls.
const STAGE_ORDER = ["text", "images", "enrich", "mindmap", "slidedeck", "infographic"];
const STAGE_LABEL = {
  text: "Text",
  images: "Images",
  enrich: "Enrich",
  mindmap: "Mind Map",
  slidedeck: "Slide Deck",
  infographic: "Infographic",
};
// text/images/enrich are real rows in education_book_ingestions with
// their own job id, log, pause/resume — mindmap/slidedeck/infographic
// are generation-only (see getGenerationStatusService) and only ever
// support a plain retry, no job id/log to drill into.
const JOB_BASED_STAGES = new Set(["text", "images", "enrich"]);

const StagePill = ({ status }) => {
  const style = status ? STATUS_STYLE[status] || STATUS_STYLE.pending : null;
  if (!style) {
    return (
      <span className="badge rounded-pill px-2 py-1" style={{ background: "rgba(100,116,139,0.08)", color: "#94a3b8", fontWeight: 600 }}>
        Not started
      </span>
    );
  }
  return (
    <span className="badge rounded-pill px-2 py-1" style={{ background: style.bg, color: style.color, fontWeight: 600 }}>
      {style.label}
    </span>
  );
};

const REFRESH_INTERVAL_MS = 5000;

const formatDuration = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const formatTimestamp = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const requesterLabel = (job) => {
  const u = job.requestedByUser;
  if (!u) return "—";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return name || u.account_email || `User #${u.user_id}`;
};

const progressText = (job) => {
  if (job.current_stage) return job.current_stage;
  if (job.items_processed != null && job.total_items != null) return `${job.items_processed}/${job.total_items}`;
  if (job.items_processed != null) return `${job.items_processed} processed`;
  return null;
};

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

/**
 * Full ingestion job log/monitor — unlike CurriculumList.jsx's inline
 * status pills (which only ever show the LATEST job per chapter per
 * job_type, no history, no timing), this shows every job across every
 * chapter/subject with real start time, elapsed/total duration, who
 * triggered it, and the full error message inline (not just a tooltip).
 */
const IngestionMonitor = ({ subjects, onClose }) => {
  // "chapters" (default) groups everything by chapter — see
  // getChapterProcessingOverview; "jobs" is the original flat, every-
  // attempt-ever list, kept as a drill-down for anyone who needs the full
  // history rather than just "what does this chapter still need".
  const [viewMode, setViewMode] = useState("chapters");

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [chapterOverview, setChapterOverview] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [expandedChapterId, setExpandedChapterId] = useState(null);

  const [subjectFilter, setSubjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  // Live CPU/GPU utilization from the AI service's own machine — see
  // core/system_resources.py. Polled independently of jobs (same 5s
  // cadence) since it's a completely separate concern/endpoint.
  const [resources, setResources] = useState(null);
  const [resourcesError, setResourcesError] = useState(false);

  // Pause/Resume for a running 'images' job — relocated here from
  // CurriculumList.jsx's per-chapter status pills (see
  // curriculumService.js's pauseIngestionJob/resumeIngestionJob). Resume
  // needs the same PDF re-uploaded (this pipeline never persists the
  // original upload anywhere Node can hand back on its own), so clicking
  // Resume just opens a hidden file picker.
  const [pauseBusyJobId, setPauseBusyJobId] = useState(null);
  const [resumeBusyJobId, setResumeBusyJobId] = useState(null);
  const [resumeTarget, setResumeTarget] = useState(null);
  const resumeFileInputRef = useRef(null);
  const [actionError, setActionError] = useState("");

  // Retry — restarts a 'failed' or 'pending' job of any type (see
  // retryIngestionJob). text/images need the same PDF re-upload as
  // resume; enrich fires immediately with no file needed.
  const [retryBusyJobId, setRetryBusyJobId] = useState(null);
  const [retryTarget, setRetryTarget] = useState(null);
  const retryFileInputRef = useRef(null);

  // Re-renders once a second purely so in-flight jobs' "elapsed" time and
  // "started Xs ago" keep ticking smoothly between the 5s network polls,
  // without needing a network call just to update a clock.
  const [, forceTick] = useState(0);

  const loadJobs = useCallback(async () => {
    try {
      const params = {};
      if (subjectFilter) params.subject_id = subjectFilter;
      const data = await getIngestionJobs(params);
      setJobs(Array.isArray(data) ? data : []);
      setLastRefreshedAt(new Date());
      setError("");
    } catch (err) {
      setError(getApiErrorMessage(err) || "Failed to load ingestion jobs");
    } finally {
      setLoading(false);
    }
  }, [subjectFilter]);

  useEffect(() => {
    setLoading(true);
    loadJobs();
  }, [loadJobs]);

  const loadOverview = useCallback(async () => {
    try {
      const params = {};
      if (subjectFilter) params.subject_id = subjectFilter;
      const data = await getChapterProcessingOverview(params);
      setChapterOverview(Array.isArray(data) ? data : []);
      setOverviewError("");
    } catch (err) {
      setOverviewError(getApiErrorMessage(err) || "Failed to load chapter overview");
    } finally {
      setOverviewLoading(false);
    }
  }, [subjectFilter]);

  useEffect(() => {
    setOverviewLoading(true);
    loadOverview();
  }, [loadOverview]);

  const loadResources = useCallback(async () => {
    try {
      const data = await getSystemResources();
      setResources(data);
      setResourcesError(false);
    } catch {
      // Non-fatal — the AI service being briefly unreachable shouldn't
      // blank out the rest of the monitor, just this one panel.
      setResourcesError(true);
    }
  }, []);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const interval = window.setInterval(() => {
      loadJobs();
      loadOverview();
      loadResources();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [autoRefresh, loadJobs, loadOverview, loadResources]);

  useEffect(() => {
    const tick = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const handlePauseImages = useCallback(
    async (job) => {
      setPauseBusyJobId(job.id);
      setActionError("");
      try {
        await pauseIngestionJob(job.id);
        await Promise.all([loadJobs(), loadOverview()]);
      } catch (err) {
        setActionError(getApiErrorMessage(err, "Failed to pause ingestion."));
      } finally {
        setPauseBusyJobId(null);
      }
    },
    [loadJobs, loadOverview]
  );

  const handleResumeImages = useCallback((job) => {
    setResumeTarget(job);
    resumeFileInputRef.current?.click();
  }, []);

  const handleResumeFileSelected = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      const target = resumeTarget;
      setResumeTarget(null);
      if (!file || !target) return;

      setResumeBusyJobId(target.id);
      setActionError("");
      try {
        await resumeIngestionJob(target.id, file);
        await Promise.all([loadJobs(), loadOverview()]);
      } catch (err) {
        setActionError(getApiErrorMessage(err, "Failed to resume ingestion."));
      } finally {
        setResumeBusyJobId(null);
      }
    },
    [resumeTarget, loadJobs, loadOverview]
  );

  const fireRetryWithoutFile = useCallback(
    async (job) => {
      setRetryBusyJobId(job.id);
      setActionError("");
      try {
        await retryIngestionJob(job.id);
        await Promise.all([loadJobs(), loadOverview()]);
      } catch (err) {
        setActionError(getApiErrorMessage(err, "Failed to retry ingestion."));
      } finally {
        setRetryBusyJobId(null);
      }
    },
    [loadJobs, loadOverview]
  );

  const handleRetryClick = useCallback(
    (job) => {
      // enrich never needs a file. text usually doesn't either once it's
      // gotten far enough to have a storage_key — the PDF is still
      // sitting in MinIO from the original attempt (see
      // retryIngestionJob/retryIngestionJobService), so retry just reuses
      // it server-side. Only images (no MinIO backup for that pipeline)
      // and a text job that failed before ever reaching storage need the
      // file re-picked.
      if (job.job_type === "enrich" || (job.job_type === "text" && job.storage_key)) {
        fireRetryWithoutFile(job);
        return;
      }
      setRetryTarget(job);
      retryFileInputRef.current?.click();
    },
    [fireRetryWithoutFile]
  );

  const handleRetryFileSelected = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      const target = retryTarget;
      setRetryTarget(null);
      if (!file || !target) return;

      setRetryBusyJobId(target.id);
      setActionError("");
      try {
        await retryIngestionJob(target.id, file);
        await Promise.all([loadJobs(), loadOverview()]);
      } catch (err) {
        setActionError(getApiErrorMessage(err, "Failed to retry ingestion."));
      } finally {
        setRetryBusyJobId(null);
      }
    },
    [retryTarget, loadJobs, loadOverview]
  );

  // Mind map / slide deck / infographic have no job id/file — a single
  // click just re-asks processChapterService for that one step, same as
  // checking its box in CurriculumList's "Process Chapter" modal, except
  // that endpoint always forces past the 3-minute stuck-row cooldown for
  // an explicit admin action like this one (see processChapterController).
  const [genRetryBusyKey, setGenRetryBusyKey] = useState(null);
  const handleRetryGeneration = useCallback(
    async (chapterId, stageKey) => {
      const key = `${chapterId}:${stageKey}`;
      setGenRetryBusyKey(key);
      setActionError("");
      try {
        await processChapter(chapterId, [stageKey], null);
        await loadOverview();
      } catch (err) {
        setActionError(getApiErrorMessage(err, "Failed to retry generation."));
      } finally {
        setGenRetryBusyKey(null);
      }
    },
    [loadOverview]
  );

  // Adapts a chapter overview stage summary (jobId/itemsProcessed/
  // hasStorageKey) into the shape handlePauseImages/handleResumeImages/
  // handleRetryClick already expect from a raw job row, so the chapter
  // view can reuse those same handlers/hidden file inputs unchanged.
  const toJobLike = (jobType, stage) =>
    stage && {
      id: stage.jobId,
      job_type: jobType,
      status: stage.status,
      items_processed: stage.itemsProcessed,
      storage_key: stage.hasStorageKey ? "present" : null,
    };

  const filteredJobs = useMemo(
    () =>
      jobs.filter(
        (j) => (!statusFilter || j.status === statusFilter) && (!jobTypeFilter || j.job_type === jobTypeFilter)
      ),
    [jobs, statusFilter, jobTypeFilter]
  );

  const activeCount = jobs.filter((j) => j.status === "processing" || j.status === "pending").length;
  const needsAttentionCount = chapterOverview.filter((c) => c.needsAttention).length;

  const gpu = resources?.gpus?.[0];

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1060 }}>
      {/* Resume needs the same PDF re-uploaded (see resumeIngestionJob) —
          one shared hidden input, opened by handleResumeImages for
          whichever job is currently in resumeTarget. */}
      <input
        type="file"
        accept="application/pdf"
        ref={resumeFileInputRef}
        onChange={handleResumeFileSelected}
        style={{ display: "none" }}
      />
      {/* Retry needs the same PDF re-uploaded for text/images (see
          retryIngestionJob) — one shared hidden input, opened by
          handleRetryClick for whichever job is currently in retryTarget. */}
      <input
        type="file"
        accept="application/pdf"
        ref={retryFileInputRef}
        onChange={handleRetryFileSelected}
        style={{ display: "none" }}
      />
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content border-0 rounded-4 shadow-lg" style={{ maxHeight: "88vh" }}>
          <div className="modal-header border-0 rounded-top-4 px-4 py-3" style={{ background: BRAND }}>
            <div>
              <h6 className="modal-title fw-bold text-white mb-0 d-flex align-items-center gap-2">
                <FaListUl />
                Ingestion Monitor
              </h6>
              <small className="text-white opacity-75">
                {viewMode === "chapters"
                  ? needsAttentionCount > 0
                    ? `${needsAttentionCount} chapter${needsAttentionCount === 1 ? "" : "s"} need attention`
                    : "Nothing needs attention"
                  : activeCount > 0
                  ? `${activeCount} job${activeCount === 1 ? "" : "s"} currently active`
                  : "Nothing currently running"}
                {lastRefreshedAt ? ` · updated ${formatDuration(Date.now() - lastRefreshedAt.getTime())} ago` : ""}
              </small>
            </div>
            <button className="btn-close btn-close-white ms-auto" onClick={onClose}></button>
          </div>

          <div className="px-4 pt-3 pb-2 border-bottom d-flex flex-wrap gap-3 align-items-center" style={{ fontSize: "0.75rem" }}>
            <span className="fw-semibold d-flex align-items-center gap-1" style={{ color: "#0d3a5c" }}>
              <FaMicrochip />
              AI Service:
            </span>
            {resourcesError ? (
              <span className="text-danger">Unreachable</span>
            ) : !resources ? (
              <span className="text-muted">Loading…</span>
            ) : (
              <>
                <span className="text-muted">
                  CPU <strong style={{ color: "#0f172a" }}>{resources.cpu.utilization_percent.toFixed(0)}%</strong>{" "}
                  ({resources.cpu.core_count} cores)
                </span>
                <span className="text-muted">
                  RAM <strong style={{ color: "#0f172a" }}>{resources.memory.utilization_percent.toFixed(0)}%</strong>{" "}
                  ({resources.memory.used_gb}/{resources.memory.total_gb} GB)
                </span>
                {gpu ? (
                  <span className="text-muted">
                    GPU <strong style={{ color: "#0f172a" }}>{gpu.gpu_utilization_percent.toFixed(0)}%</strong> ·{" "}
                    VRAM <strong style={{ color: "#0f172a" }}>{Math.round((gpu.memory_used_mb / gpu.memory_total_mb) * 100)}%</strong>{" "}
                    ({(gpu.memory_used_mb / 1024).toFixed(1)}/{(gpu.memory_total_mb / 1024).toFixed(1)} GB) · {gpu.temperature_c}°C
                  </span>
                ) : (
                  <span className="text-muted">No GPU detected</span>
                )}
                <span className="text-muted">
                  Vision model <strong style={{ color: "#0f172a" }}>{resources.vision_runtime.model || "—"}</strong> (
                  {resources.vision_runtime.mode})
                </span>
              </>
            )}
          </div>

          <div className="px-4 pt-3 pb-2 border-bottom d-flex flex-wrap gap-2 align-items-center">
            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className={`btn rounded-start-3 d-flex align-items-center gap-1 ${viewMode === "chapters" ? "text-white" : "btn-outline-secondary"}`}
                style={viewMode === "chapters" ? { background: BRAND, border: "none" } : undefined}
                onClick={() => setViewMode("chapters")}
              >
                <FaLayerGroup style={{ fontSize: "0.7rem" }} />
                By Chapter
              </button>
              <button
                type="button"
                className={`btn rounded-end-3 d-flex align-items-center gap-1 ${viewMode === "jobs" ? "text-white" : "btn-outline-secondary"}`}
                style={viewMode === "jobs" ? { background: BRAND, border: "none" } : undefined}
                onClick={() => setViewMode("jobs")}
              >
                <FaListUl style={{ fontSize: "0.7rem" }} />
                All Job History
              </button>
            </div>

            <select
              className="form-select form-select-sm rounded-3"
              style={{ maxWidth: 200 }}
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="">All Subjects</option>
              {(subjects || []).map((s) => (
                <option key={s.subject_id} value={s.subject_id}>
                  {s.name}
                </option>
              ))}
            </select>
            {viewMode === "jobs" && (
              <>
                <select
                  className="form-select form-select-sm rounded-3"
                  style={{ maxWidth: 160 }}
                  value={jobTypeFilter}
                  onChange={(e) => setJobTypeFilter(e.target.value)}
                >
                  <option value="">All Job Types</option>
                  <option value="text">Text</option>
                  <option value="images">Images</option>
                  <option value="enrich">Enrich</option>
                </select>
                <select
                  className="form-select form-select-sm rounded-3"
                  style={{ maxWidth: 160 }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="paused">Paused</option>
                </select>
              </>
            )}

            <div className="ms-auto d-flex align-items-center gap-2">
              <label className="d-flex align-items-center gap-1 small text-muted" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                Auto-refresh (5s)
              </label>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-1"
                onClick={() => {
                  loadJobs();
                  loadOverview();
                }}
              >
                <FaSyncAlt style={{ fontSize: "0.7rem" }} />
                Refresh
              </button>
            </div>
          </div>

          <div className="modal-body px-0 py-0" style={{ overflowY: "auto" }}>
            {viewMode === "chapters" ? (
              overviewLoading ? (
                <div className="d-flex justify-content-center align-items-center py-5">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              ) : overviewError ? (
                <div className="alert alert-danger border-0 rounded-3 m-4 small">{overviewError}</div>
              ) : chapterOverview.length === 0 ? (
                <div className="text-center py-5 text-muted small">
                  No chapters have any ingestion or generation activity yet.
                </div>
              ) : (
                <table className="table table-hover align-middle mb-0" style={{ fontSize: "0.8rem" }}>
                  <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 1 }}>
                    <tr>
                      <th style={{ width: 24 }} />
                      <th>Subject / Chapter</th>
                      {STAGE_ORDER.map((stageKey) => (
                        <th key={stageKey}>{STAGE_LABEL[stageKey]}</th>
                      ))}
                      <th>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chapterOverview.map((row) => {
                      const isExpanded = expandedChapterId === row.chapter_id;
                      const stageTimestamps = STAGE_ORDER.map((k) => row.stages[k]?.updatedAt).filter(Boolean);
                      const lastUpdated = stageTimestamps.length > 0 ? new Date(Math.max(...stageTimestamps.map((t) => new Date(t).getTime()))) : null;

                      return (
                        <Fragment key={row.chapter_id}>
                          <tr
                            style={{ cursor: "pointer" }}
                            onClick={() => setExpandedChapterId(isExpanded ? null : row.chapter_id)}
                          >
                            <td className="text-muted">{isExpanded ? <FaChevronDown /> : <FaChevronRight />}</td>
                            <td>
                              <div className="fw-semibold d-flex align-items-center gap-2" style={{ color: "#0f172a" }}>
                                {row.chapter_name}
                                {row.needsAttention && <FaExclamationTriangle style={{ color: "#dc2626", fontSize: "0.7rem" }} title="Needs attention" />}
                              </div>
                              <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                {row.subject_name || "—"}
                                {row.class_name ? ` · Class ${row.class_name}` : ""}
                              </div>
                            </td>
                            {STAGE_ORDER.map((stageKey) => (
                              <td key={stageKey}>
                                <StagePill status={row.stages[stageKey]?.status} />
                              </td>
                            ))}
                            <td className="text-muted">{lastUpdated ? formatTimestamp(lastUpdated) : "—"}</td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={STAGE_ORDER.length + 3} className="bg-light">
                                {actionError && (
                                  <div className="px-3 pt-2 text-danger small" onClick={(e) => e.stopPropagation()}>
                                    {actionError}
                                  </div>
                                )}
                                <div className="row g-2 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                                  {STAGE_ORDER.map((stageKey) => {
                                    const stage = row.stages[stageKey];
                                    const busyKey = `${row.chapter_id}:${stageKey}`;
                                    return (
                                      <div key={stageKey} className="col-md-4">
                                        <div className="border rounded-3 p-2 h-100 bg-white">
                                          <div className="d-flex justify-content-between align-items-center mb-1">
                                            <span className="fw-semibold small">{STAGE_LABEL[stageKey]}</span>
                                            <StagePill status={stage?.status} />
                                          </div>
                                          {stage?.errorMessage && (
                                            <div className="text-danger mb-1" style={{ fontSize: "0.7rem" }}>
                                              {stage.errorMessage}
                                            </div>
                                          )}
                                          {stage?.updatedAt && (
                                            <div className="text-muted mb-1" style={{ fontSize: "0.65rem" }}>
                                              Updated {formatTimestamp(stage.updatedAt)}
                                            </div>
                                          )}
                                          {JOB_BASED_STAGES.has(stageKey) ? (
                                            <>
                                              {stageKey === "images" && stage?.status === "processing" && (
                                                <button
                                                  type="button"
                                                  className="btn btn-sm rounded-3 d-flex align-items-center gap-1"
                                                  style={{ background: "#d97706", color: "#fff", border: "none" }}
                                                  disabled={pauseBusyJobId === stage.jobId}
                                                  onClick={() => handlePauseImages(toJobLike("images", stage))}
                                                >
                                                  <FaPauseCircle />
                                                  {pauseBusyJobId === stage.jobId ? "Pausing…" : "Pause"}
                                                </button>
                                              )}
                                              {stageKey === "images" && stage?.status === "paused" && (
                                                <button
                                                  type="button"
                                                  className="btn btn-sm rounded-3 d-flex align-items-center gap-1"
                                                  style={{ background: "#2563eb", color: "#fff", border: "none" }}
                                                  disabled={resumeBusyJobId === stage.jobId}
                                                  onClick={() => handleResumeImages(toJobLike("images", stage))}
                                                >
                                                  <FaPlayCircle />
                                                  {resumeBusyJobId === stage.jobId ? "Resuming…" : `Resume from page ${(stage.itemsProcessed ?? 0) + 1}`}
                                                </button>
                                              )}
                                              {(stage?.status === "failed" || stage?.status === "pending") && (
                                                <button
                                                  type="button"
                                                  className="btn btn-sm rounded-3 d-flex align-items-center gap-1"
                                                  style={{ background: "#16a34a", color: "#fff", border: "none" }}
                                                  disabled={retryBusyJobId === stage.jobId}
                                                  onClick={() => handleRetryClick(toJobLike(stageKey, stage))}
                                                  title={
                                                    stageKey === "text" && stage.hasStorageKey
                                                      ? "Reuses the previously uploaded PDF — no re-upload needed"
                                                      : stageKey !== "enrich"
                                                      ? "You'll be asked to re-upload the PDF"
                                                      : undefined
                                                  }
                                                >
                                                  <FaRedo />
                                                  {retryBusyJobId === stage.jobId
                                                    ? "Retrying…"
                                                    : stageKey === "images"
                                                    ? `Retry from page ${(stage.itemsProcessed ?? 0) + 1}`
                                                    : "Retry"}
                                                </button>
                                              )}
                                              {!stage && <div className="text-muted" style={{ fontSize: "0.7rem" }}>Not started</div>}
                                            </>
                                          ) : (
                                            (!stage?.status || stage.status === "failed") && (
                                              <button
                                                type="button"
                                                className="btn btn-sm rounded-3 d-flex align-items-center gap-1"
                                                style={{ background: stage?.status === "failed" ? "#16a34a" : "#0d3a5c", color: "#fff", border: "none" }}
                                                disabled={genRetryBusyKey === busyKey}
                                                onClick={() => handleRetryGeneration(row.chapter_id, stageKey)}
                                                title={stage?.status === "failed" ? undefined : "Text must be ingested first"}
                                              >
                                                <FaRedo />
                                                {genRetryBusyKey === busyKey ? "Retrying…" : stage?.status === "failed" ? "Retry" : "Generate"}
                                              </button>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )
            ) : loading ? (
              <div className="d-flex justify-content-center align-items-center py-5">
                <div className="spinner-border text-primary" role="status" />
              </div>
            ) : error ? (
              <div className="alert alert-danger border-0 rounded-3 m-4 small">{error}</div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-5 text-muted small">No ingestion jobs match these filters.</div>
            ) : (
              <table className="table table-hover align-middle mb-0" style={{ fontSize: "0.8rem" }}>
                <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 1 }}>
                  <tr>
                    <th style={{ width: 24 }} />
                    <th>Subject / Chapter</th>
                    <th>Job</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Started</th>
                    <th>Duration</th>
                    <th>Requested By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => {
                    const style = STATUS_STYLE[job.status] || STATUS_STYLE.pending;
                    const isExpanded = expandedId === job.id;
                    const startedAt = job.created_at ? new Date(job.created_at).getTime() : null;
                    const endedAt = TERMINAL_STATUSES.has(job.status) && job.updated_at ? new Date(job.updated_at).getTime() : null;
                    const durationMs = startedAt != null ? (endedAt ?? Date.now()) - startedAt : null;
                    const isLive = !TERMINAL_STATUSES.has(job.status);

                    return (
                      <Fragment key={job.id}>
                        <tr
                          style={{ cursor: "pointer" }}
                          onClick={() => setExpandedId(isExpanded ? null : job.id)}
                        >
                          <td className="text-muted">{isExpanded ? <FaChevronDown /> : <FaChevronRight />}</td>
                          <td>
                            <div className="fw-semibold" style={{ color: "#0f172a" }}>
                              {job.chapter?.name || `Chapter #${job.chapter_id}`}
                            </div>
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                              {job.chapter?.subject?.name || "—"}
                              {job.chapter?.class?.name ? ` · Class ${job.chapter.class.name}` : ""}
                            </div>
                          </td>
                          <td>{JOB_TYPE_LABEL[job.job_type] || job.job_type}</td>
                          <td>
                            <span
                              className="badge rounded-pill px-2 py-1"
                              style={{ background: style.bg, color: style.color, fontWeight: 600 }}
                            >
                              {style.label}
                            </span>
                            {job.status === "failed" && (
                              <FaExclamationTriangle className="ms-1" style={{ color: "#dc2626", fontSize: "0.7rem" }} />
                            )}
                          </td>
                          <td className="text-muted">{progressText(job) || "—"}</td>
                          <td className="text-muted">{formatTimestamp(job.created_at)}</td>
                          <td className="text-muted">
                            {durationMs != null ? formatDuration(durationMs) : "—"}
                            {isLive && durationMs != null && (
                              <span
                                className="ms-1 rounded-circle d-inline-block"
                                style={{ width: 6, height: 6, background: "#2563eb", animation: "pulse 1.5s infinite" }}
                                title="Still running"
                              />
                            )}
                          </td>
                          <td className="text-muted">{requesterLabel(job)}</td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="bg-light">
                              {job.job_type === "images" && (job.status === "processing" || job.status === "paused") && (
                                <div
                                  className="d-flex align-items-center gap-2 px-3 pt-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {job.status === "processing" && (
                                    <button
                                      type="button"
                                      className="btn btn-sm rounded-3 d-flex align-items-center gap-1"
                                      style={{ background: "#d97706", color: "#fff", border: "none" }}
                                      disabled={pauseBusyJobId === job.id}
                                      onClick={() => handlePauseImages(job)}
                                    >
                                      <FaPauseCircle />
                                      {pauseBusyJobId === job.id ? "Pausing…" : "Pause"}
                                    </button>
                                  )}
                                  {job.status === "paused" && (
                                    <button
                                      type="button"
                                      className="btn btn-sm rounded-3 d-flex align-items-center gap-1"
                                      style={{ background: "#2563eb", color: "#fff", border: "none" }}
                                      disabled={resumeBusyJobId === job.id}
                                      onClick={() => handleResumeImages(job)}
                                    >
                                      <FaPlayCircle />
                                      {resumeBusyJobId === job.id ? "Resuming…" : `Resume from page ${(job.items_processed ?? 0) + 1}`}
                                    </button>
                                  )}
                                </div>
                              )}
                              {(job.status === "failed" || job.status === "pending") && (
                                <div
                                  className="d-flex align-items-center gap-2 px-3 pt-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    className="btn btn-sm rounded-3 d-flex align-items-center gap-1"
                                    style={{ background: "#16a34a", color: "#fff", border: "none" }}
                                    disabled={retryBusyJobId === job.id}
                                    onClick={() => handleRetryClick(job)}
                                    title={
                                      job.job_type === "text" && job.storage_key
                                        ? "Reuses the previously uploaded PDF — no re-upload needed"
                                        : job.job_type !== "enrich"
                                        ? "You'll be asked to re-upload the PDF"
                                        : undefined
                                    }
                                  >
                                    <FaRedo />
                                    {retryBusyJobId === job.id
                                      ? "Retrying…"
                                      : job.job_type === "images"
                                      ? `Retry from page ${(job.items_processed ?? 0) + 1}`
                                      : "Retry"}
                                  </button>
                                </div>
                              )}
                              {actionError && (
                                <div className="px-3 pt-2 text-danger small" onClick={(e) => e.stopPropagation()}>
                                  {actionError}
                                </div>
                              )}
                              <div className="row g-3 px-3 py-2 small">
                                <div className="col-md-3">
                                  <div className="text-muted">Job ID</div>
                                  <div className="fw-semibold">{job.id}</div>
                                </div>
                                <div className="col-md-3">
                                  <div className="text-muted">Source File</div>
                                  <div className="fw-semibold">{job.source_filename || "—"}</div>
                                </div>
                                <div className="col-md-3">
                                  <div className="text-muted">Storage Key</div>
                                  <div className="fw-semibold text-truncate" title={job.storage_key || ""}>
                                    {job.storage_key || "—"}
                                  </div>
                                </div>
                                <div className="col-md-3">
                                  <div className="text-muted">Chunks / Items</div>
                                  <div className="fw-semibold">
                                    {job.chunks_ingested ?? job.items_processed ?? "—"}
                                    {job.total_items != null ? ` / ${job.total_items}` : ""}
                                  </div>
                                </div>
                                <div className="col-md-3">
                                  <div className="text-muted">Last Updated</div>
                                  <div className="fw-semibold">{formatTimestamp(job.updated_at)}</div>
                                </div>
                                <div className="col-md-3">
                                  <div className="text-muted">Waits For Job</div>
                                  <div className="fw-semibold">{job.waits_for_job_id || "—"}</div>
                                </div>
                                <div className="col-md-3">
                                  <div className="text-muted">Pause Requested</div>
                                  <div className="fw-semibold">{job.pause_requested ? "Yes" : "No"}</div>
                                </div>
                                <div className="col-md-3">
                                  <div className="text-muted">Also Generates</div>
                                  <div className="fw-semibold">
                                    {Array.isArray(job.also_generate) && job.also_generate.length > 0
                                      ? job.also_generate.join(", ")
                                      : "—"}
                                  </div>
                                </div>
                                {job.error_message && (
                                  <div className="col-12">
                                    <div className="text-muted">Error</div>
                                    <div className="fw-semibold" style={{ color: "#dc2626", whiteSpace: "pre-wrap" }}>
                                      {job.error_message}
                                    </div>
                                  </div>
                                )}
                                <div className="col-12">
                                  <div className="text-muted mb-1">
                                    Log ({(job.logs || []).length} entr{(job.logs || []).length === 1 ? "y" : "ies"})
                                  </div>
                                  {!job.logs || job.logs.length === 0 ? (
                                    <div className="text-muted fst-italic">
                                      No log entries yet — jobs started before this feature shipped won't have any.
                                    </div>
                                  ) : (
                                    <div
                                      className="rounded-3 p-2"
                                      style={{
                                        background: "#0f172a",
                                        color: "#e2e8f0",
                                        maxHeight: 220,
                                        overflowY: "auto",
                                        fontFamily: "monospace",
                                        fontSize: "0.72rem",
                                      }}
                                    >
                                      {job.logs.map((entry, i) => (
                                        <div key={i} className="d-flex gap-2">
                                          <span style={{ color: "#64748b", flexShrink: 0 }}>
                                            {new Date(entry.at).toLocaleTimeString(undefined, {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                              second: "2-digit",
                                            })}
                                          </span>
                                          <span>{entry.message}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="modal-footer border-0 px-4 py-2">
            <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }`}</style>
    </div>
  );
};

export default IngestionMonitor;
