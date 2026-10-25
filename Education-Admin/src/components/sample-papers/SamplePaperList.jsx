import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSamplePapers,
  createSamplePaper,
  extractSamplePaper,
  getExtractionJobs,
} from "../../services/samplePaperService.js";
import { getAcademicSubjects, getAcademicClasses } from "../../services/curriculumService.js";
import { getApiErrorMessage } from "../../services/errorMessage.js";
import { useRBAC } from "../../shared/component/RBACProvider.jsx";
import ToastMessage from "../../shared/component/ToastMessage.jsx";
import SamplePaperReview from "./SamplePaperReview.jsx";
import {
  FaFileAlt,
  FaPlus,
  FaCheck,
  FaCloudUploadAlt,
  FaUpload,
  FaExclamationTriangle,
  FaEye,
} from "react-icons/fa";

const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";

const PAPER_STATUS_STYLE = {
  draft: { bg: "rgba(100,116,139,0.14)", color: "#64748b", label: "Draft" },
  pending_review: { bg: "rgba(217,119,6,0.12)", color: "#d97706", label: "Pending Review" },
  published: { bg: "rgba(22,163,74,0.12)", color: "#16a34a", label: "Published" },
  archived: { bg: "rgba(100,116,139,0.14)", color: "#64748b", label: "Archived" },
};

const JOB_STATUS_STYLE = {
  pending: { bg: "rgba(100,116,139,0.14)", color: "#64748b", label: "Pending" },
  processing: { bg: "rgba(37,99,235,0.12)", color: "#2563eb", label: "Extracting…" },
  completed: { bg: "rgba(22,163,74,0.12)", color: "#16a34a", label: "Extracted" },
  failed: { bg: "rgba(220,38,38,0.12)", color: "#dc2626", label: "Extraction Failed" },
};

const Badge = ({ style }) => (
  <span
    className="badge rounded-pill px-3 py-2"
    style={{ background: style.bg, color: style.color, fontWeight: 600, fontSize: "0.75rem", border: `1px solid ${style.color}33` }}
  >
    {style.label}
  </span>
);

// ─── Create Paper Modal ─────────────────────────────────────────────────────

const CreatePaperModal = ({ subjects, classes, onSave, onClose, saving, errorMessage, onClearError }) => {
  const [form, setForm] = useState({ title: "", subject_id: "", class_id: "", paper_type: "major_test" });

  const set = (k, v) => {
    if (errorMessage && onClearError) onClearError();
    setForm((f) => ({ ...f, [k]: v }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      title: form.title.trim(),
      subject_id: Number(form.subject_id),
      class_id: Number(form.class_id),
      paper_type: form.paper_type,
    });
  };

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-0 rounded-top-4 px-4 py-3" style={{ background: BRAND }}>
            <h5 className="modal-title fw-bold text-white mb-0">
              <FaFileAlt className="me-2" />
              New Sample Paper
            </h5>
            <button className="btn-close btn-close-white ms-auto" onClick={onClose} disabled={saving}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body px-4 py-3">
              {errorMessage ? (
                <div className="alert alert-danger border-0 rounded-3 py-2 px-3 mb-3 small d-flex align-items-start gap-2">
                  <FaExclamationTriangle className="mt-1" />
                  {errorMessage}
                </div>
              ) : null}
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Title <span className="text-danger">*</span>
                  </label>
                  <input
                    className="form-control rounded-3"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    required
                    placeholder="e.g. Major Test 1 — Mathematics"
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Subject <span className="text-danger">*</span>
                  </label>
                  <select className="form-select rounded-3" value={form.subject_id} onChange={(e) => set("subject_id", e.target.value)} required>
                    <option value="">— Select Subject —</option>
                    {subjects.map((s) => (
                      <option key={s.subject_id} value={s.subject_id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Class <span className="text-danger">*</span>
                  </label>
                  <select className="form-select rounded-3" value={form.class_id} onChange={(e) => set("class_id", e.target.value)} required>
                    <option value="">— Select Class —</option>
                    {classes.map((c) => (
                      <option key={c.class_id} value={c.class_id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Paper Type <span className="text-danger">*</span>
                  </label>
                  <select className="form-select rounded-3" value={form.paper_type} onChange={(e) => set("paper_type", e.target.value)} required>
                    <option value="major_test">Major Test</option>
                    <option value="semi_major">Semi Major</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer border-0 px-4 pb-4">
              <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn text-white rounded-3 px-4" style={{ background: BRAND }} disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-2"></span> : <FaCheck className="me-2" />}
                Create
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Upload Paper + Solution Modal ──────────────────────────────────────────

const UploadModal = ({ paper, onSubmit, onClose, uploading, errorMessage, onClearError }) => {
  const [paperFile, setPaperFile] = useState(null);
  const [solutionFile, setSolutionFile] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!paperFile || !solutionFile) return;
    onSubmit(paperFile, solutionFile);
  };

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-0 rounded-top-4 px-4 py-3" style={{ background: BRAND }}>
            <div>
              <h6 className="modal-title fw-bold text-white mb-0">
                <FaCloudUploadAlt className="me-2" />
                Upload Paper + Solution
              </h6>
              <small className="text-white opacity-75">{paper.title}</small>
            </div>
            <button className="btn-close btn-close-white ms-auto" onClick={onClose} disabled={uploading}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body px-4 py-3">
              {errorMessage ? (
                <div className="alert alert-danger border-0 rounded-3 py-2 px-3 mb-3 small">{errorMessage}</div>
              ) : null}
              <div className="mb-3">
                <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                  Question Paper PDF <span className="text-danger">*</span>
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  className="form-control rounded-3"
                  onChange={(e) => {
                    setPaperFile(e.target.files?.[0] || null);
                    if (errorMessage && onClearError) onClearError();
                  }}
                  required
                />
              </div>
              <div className="mb-2">
                <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                  Real Solution PDF <span className="text-danger">*</span>
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  className="form-control rounded-3"
                  onChange={(e) => {
                    setSolutionFile(e.target.files?.[0] || null);
                    if (errorMessage && onClearError) onClearError();
                  }}
                  required
                />
              </div>
              <p className="text-muted small mt-2 mb-0">
                Both PDFs are read page by page and questions are matched to their real answers by number — this
                runs in the background and typically takes several minutes for a full paper.
              </p>
            </div>
            <div className="modal-footer border-0 px-4 pb-4">
              <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose} disabled={uploading}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn text-white rounded-3 px-4"
                style={{ background: BRAND }}
                disabled={uploading || !paperFile || !solutionFile}
              >
                {uploading ? <span className="spinner-border spinner-border-sm me-2"></span> : <FaUpload className="me-2" />}
                Start Extraction
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Main List Component ────────────────────────────────────────────────────

const SamplePaperList = () => {
  const { can, loading: rbacLoading } = useRBAC();
  const canCreate = can(["sample_papers_management", "sample papers"], "create");
  const canUpdate = can(["sample_papers_management", "sample papers"], "update");

  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [uploadTarget, setUploadTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [jobsByPaper, setJobsByPaper] = useState({});
  const [selectedPaper, setSelectedPaper] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    getAcademicSubjects().then(setSubjects).catch(() => {});
    getAcademicClasses().then(setClasses).catch(() => {});
  }, []);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSamplePapers();
      setPapers(data);
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to load sample papers."), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPapers(); }, [fetchPapers]);

  const refreshJobs = useCallback(async () => {
    try {
      const jobs = await getExtractionJobs();
      const latestByPaper = {};
      for (const job of jobs) {
        if (!(job.sample_paper_id in latestByPaper)) latestByPaper[job.sample_paper_id] = job;
      }
      setJobsByPaper(latestByPaper);
    } catch {
      // Non-fatal — falls back to no badge until the next successful refresh.
    }
  }, []);

  useEffect(() => { if (papers.length > 0) refreshJobs(); }, [papers, refreshJobs]);

  const hasActiveJob = useMemo(
    () => Object.values(jobsByPaper).some((job) => job.status === "pending" || job.status === "processing"),
    [jobsByPaper]
  );

  useEffect(() => {
    if (!hasActiveJob) return;
    const interval = window.setInterval(refreshJobs, 5000);
    return () => window.clearInterval(interval);
  }, [hasActiveJob, refreshJobs]);

  // Refetch the paper's own questions once its extraction job completes, so
  // the "Review" action reflects the just-extracted questions without a
  // manual page reload.
  const prevJobsRef = useState({})[0];
  useEffect(() => {
    Object.entries(jobsByPaper).forEach(([paperId, job]) => {
      if (job.status === "completed" && prevJobsRef[paperId]?.status !== "completed") {
        fetchPapers();
      }
    });
    Object.assign(prevJobsRef, jobsByPaper);
  }, [jobsByPaper, fetchPapers, prevJobsRef]);

  const subjectName = (id) => subjects.find((s) => String(s.subject_id) === String(id))?.name || "—";
  const className = (id) => classes.find((c) => String(c.class_id) === String(id))?.name || "—";

  const handleCreate = async (payload) => {
    setCreating(true);
    try {
      await createSamplePaper(payload);
      showToast("Sample paper created — upload its Paper + Solution PDFs next.");
      setShowCreate(false);
      setCreateError("");
      fetchPapers();
    } catch (err) {
      setCreateError(getApiErrorMessage(err, "Failed to create sample paper."));
    } finally {
      setCreating(false);
    }
  };

  const handleUpload = async (paperFile, solutionFile) => {
    setUploading(true);
    try {
      const job = await extractSamplePaper(uploadTarget.sample_paper_id, paperFile, solutionFile);
      setJobsByPaper((prev) => ({ ...prev, [uploadTarget.sample_paper_id]: job }));
      showToast("Extraction started — this runs in the background.");
      setUploadTarget(null);
      setUploadError("");
      refreshJobs();
    } catch (err) {
      setUploadError(getApiErrorMessage(err, "Failed to start extraction."));
    } finally {
      setUploading(false);
    }
  };

  if (rbacLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border" style={{ color: "#1a709b" }}></div>
      </div>
    );
  }

  if (selectedPaper) {
    return (
      <SamplePaperReview
        samplePaperId={selectedPaper}
        onBack={() => setSelectedPaper(null)}
        onPublished={() => {
          fetchPapers();
          showToast("Sample paper published.");
        }}
      />
    );
  }

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      <ToastMessage toast={toast} />

      {showCreate && (
        <CreatePaperModal
          subjects={subjects}
          classes={classes}
          onSave={handleCreate}
          onClose={() => { setShowCreate(false); setCreateError(""); }}
          saving={creating}
          errorMessage={createError}
          onClearError={() => setCreateError("")}
        />
      )}

      {uploadTarget && (
        <UploadModal
          paper={uploadTarget}
          onSubmit={handleUpload}
          onClose={() => { setUploadTarget(null); setUploadError(""); }}
          uploading={uploading}
          errorMessage={uploadError}
          onClearError={() => setUploadError("")}
        />
      )}

      <div className="rounded-4 mb-4 p-4 text-white position-relative" style={{ background: BRAND }}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h4 className="fw-bold mb-1">
              <FaFileAlt className="me-2" />
              Sample Papers
            </h4>
            <p className="mb-0 opacity-75 small">
              Upload real exam papers + their real solutions, review the extracted questions, and publish.
            </p>
          </div>
          {canCreate && (
            <button
              className="btn btn-light rounded-3 px-4 d-flex align-items-center gap-2 fw-semibold"
              onClick={() => { setCreateError(""); setShowCreate(true); }}
              style={{ color: "#0d3a5c" }}
            >
              <FaPlus />
              New Sample Paper
            </button>
          )}
        </div>
      </div>

      <div className="card border-0 rounded-4 shadow-sm">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color: "#1a709b" }}></div>
            <p className="text-muted mt-2 small">Loading sample papers...</p>
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center py-5">
            <FaFileAlt className="fs-1 text-muted opacity-40" />
            <p className="text-muted mt-2">No sample papers yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th className="px-4 py-3 fw-semibold small" style={{ color: "#64748b" }}>Title</th>
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Subject</th>
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Class</th>
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Marks</th>
                  <th className="py-3 fw-semibold small text-center" style={{ color: "#64748b" }}>Status</th>
                  <th className="py-3 fw-semibold small text-center" style={{ color: "#64748b" }}>Extraction</th>
                  <th className="py-3 fw-semibold small text-end pe-4" style={{ color: "#64748b" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {papers.map((paper) => {
                  const job = jobsByPaper[paper.sample_paper_id];
                  const questionCount = paper.questions?.length || 0;
                  const approvedCount = paper.questions?.filter((q) => q.review_status === "approved").length || 0;
                  return (
                    <tr key={paper.sample_paper_id}>
                      <td className="px-4 fw-semibold" style={{ color: "#1e293b" }}>{paper.title}</td>
                      <td className="text-muted small">{subjectName(paper.subject_id)}</td>
                      <td className="text-muted small">{className(paper.class_id)}</td>
                      <td className="text-muted small">{paper.total_marks ?? "—"}</td>
                      <td className="text-center">
                        <Badge style={PAPER_STATUS_STYLE[paper.status] || PAPER_STATUS_STYLE.draft} />
                      </td>
                      <td className="text-center">
                        {job ? (
                          <Badge style={JOB_STATUS_STYLE[job.status] || JOB_STATUS_STYLE.pending} />
                        ) : questionCount > 0 ? (
                          <span className="text-muted small">{approvedCount}/{questionCount} approved</span>
                        ) : (
                          <span className="text-muted small">Not started</span>
                        )}
                      </td>
                      <td className="text-end pe-4">
                        <div className="d-flex justify-content-end gap-1">
                          {canUpdate && !paper.source_pdf_key && (
                            <button
                              className="btn btn-sm btn-light rounded-3"
                              onClick={() => { setUploadTarget(paper); setUploadError(""); }}
                              title="Upload Paper + Solution"
                            >
                              <FaUpload />
                            </button>
                          )}
                          {questionCount > 0 && (
                            <button
                              className="btn btn-sm btn-light rounded-3"
                              onClick={() => setSelectedPaper(paper.sample_paper_id)}
                              title="Review Questions"
                            >
                              <FaEye />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SamplePaperList;
