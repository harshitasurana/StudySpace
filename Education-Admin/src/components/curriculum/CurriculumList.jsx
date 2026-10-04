import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getChapters,
  createChapter,
  updateChapter,
  deleteChapter,
  getAcademicBoards,
  getAcademicClasses,
  getAcademicSubjects,
  createAcademicBoard,
  createAcademicClass,
  createAcademicSubject,
  updateAcademicSubject,
  processChapter,
  getGenerationStatus,
} from "../../services/curriculumService.js";
import { getApiErrorMessage } from "../../services/errorMessage.js";
import { useRBAC } from "../../shared/component/RBACProvider.jsx";
import ToastMessage from "../../shared/component/ToastMessage.jsx";
import IngestionMonitor from "./IngestionMonitor.jsx";
import {
  FaBook,
  FaPlus,
  FaSearch,
  FaTimes,
  FaPencilAlt,
  FaTrashAlt,
  FaCheckCircle,
  FaMinusCircle,
  FaCheck,
  FaExclamationTriangle,
  FaUpload,
  FaCloudUploadAlt,
  FaListUl,
} from "react-icons/fa";

const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";

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
    {active ? <FaCheckCircle className="me-1" /> : <FaMinusCircle className="me-1" />}
    {active ? "Active" : "Inactive"}
  </span>
);

// ─── Chapter Form Modal ─────────────────────────────────────────────────────

const ChapterFormModal = ({ chapter, subjects, classes, defaultSubjectId, defaultClassId, onSave, onClose, saving, errorMessage, onClearError }) => {
  const [form, setForm] = useState({
    name: chapter?.name || "",
    subject_id: chapter?.subject_id || defaultSubjectId || "",
    class_id: chapter?.class_id || defaultClassId || "",
    chapter_order: chapter?.chapter_order ?? "",
    source_file: chapter?.source_file || "",
    icon: chapter?.icon || "",
    academic_year: chapter?.academic_year || "",
    // '' = no split (every subject except English today) — sent as null,
    // never as an empty string, since the backend's CHECK constraint only
    // allows 'prose' | 'poetry' | NULL.
    content_type: chapter?.content_type || "",
    is_active: chapter?.is_active ?? true,
  });

  const set = (k, v) => {
    if (errorMessage && onClearError) onClearError();
    setForm((f) => ({ ...f, [k]: v }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      subject_id: Number(form.subject_id),
      class_id: Number(form.class_id),
      chapter_order: Number(form.chapter_order),
      source_file: form.source_file.trim(),
      icon: form.icon.trim() || null,
      academic_year: form.academic_year.trim() || null,
      content_type: form.content_type || null,
    };
    if (chapter) payload.is_active = !!form.is_active;
    onSave(payload);
  };

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-0 rounded-top-4 px-4 py-3" style={{ background: BRAND }}>
            <div>
              <h5 className="modal-title fw-bold text-white mb-0">
                <FaBook className="me-2" />
                {chapter ? "Edit Chapter" : "Add Chapter"}
              </h5>
              <small className="text-white opacity-75">Define a curriculum chapter and its ordering</small>
            </div>
            <button className="btn-close btn-close-white ms-auto" onClick={onClose} disabled={saving}></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body px-4 py-3">
              {errorMessage ? (
                <div className="alert alert-danger border-0 rounded-3 py-2 px-3 mb-3" role="alert">
                  <div className="d-flex align-items-start gap-2">
                    <FaExclamationTriangle className="mt-1" />
                    <div className="small fw-semibold">{errorMessage}</div>
                  </div>
                </div>
              ) : null}

              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Chapter Name <span className="text-danger">*</span>
                  </label>
                  <input
                    className="form-control rounded-3"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    required
                    placeholder="e.g. Number Systems"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Subject <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select rounded-3"
                    value={form.subject_id}
                    onChange={(e) => set("subject_id", e.target.value)}
                    required
                  >
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
                  <select
                    className="form-select rounded-3"
                    value={form.class_id}
                    onChange={(e) => set("class_id", e.target.value)}
                    required
                  >
                    <option value="">— Select Class —</option>
                    {classes.map((c) => (
                      <option key={c.class_id} value={c.class_id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-6 col-md-3">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Order <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    className="form-control rounded-3"
                    value={form.chapter_order}
                    onChange={(e) => set("chapter_order", e.target.value)}
                    min={1}
                    required
                    placeholder="1"
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Source File
                  </label>
                  <input
                    className="form-control rounded-3"
                    value={form.source_file}
                    onChange={(e) => set("source_file", e.target.value)}
                    placeholder="Auto-generated once a PDF is ingested"
                  />
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Academic Year
                  </label>
                  <input
                    className="form-control rounded-3"
                    value={form.academic_year}
                    onChange={(e) => set("academic_year", e.target.value)}
                    placeholder="e.g. 2026-27"
                  />
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Icon
                  </label>
                  <input
                    className="form-control rounded-3"
                    value={form.icon}
                    onChange={(e) => set("icon", e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                    Section
                  </label>
                  <select
                    className="form-select rounded-3"
                    value={form.content_type}
                    onChange={(e) => set("content_type", e.target.value)}
                  >
                    <option value="">— None —</option>
                    <option value="prose">Prose</option>
                    <option value="poetry">Poetry</option>
                  </select>
                  <small className="text-muted">Only relevant for a subject with a Prose/Poetry split, e.g. English.</small>
                </div>

                {chapter && (
                  <div className="col-12">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="chapterActive"
                        checked={form.is_active}
                        onChange={(e) => set("is_active", e.target.checked)}
                      />
                      <label className="form-check-label small fw-semibold" htmlFor="chapterActive" style={{ color: "#0d3a5c" }}>
                        Active
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer border-0 px-4 pb-4">
              <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn text-white rounded-3 px-4" style={{ background: BRAND }} disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-2"></span> : <FaCheck className="me-2" />}
                {chapter ? "Save Changes" : "Add Chapter"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Confirm ─────────────────────────────────────────────────────────

const DeleteModal = ({ chapter, onConfirm, onClose, deleting }) => (
  <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1070 }}>
    <div className="modal-dialog modal-dialog-centered modal-sm">
      <div className="modal-content border-0 rounded-4 shadow-lg">
        <div className="modal-body text-center px-4 py-4">
          <div
            className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle"
            style={{ width: 56, height: 56, background: "rgba(220,38,38,0.1)" }}
          >
            <FaTrashAlt className="fs-4 text-danger" />
          </div>
          <h6 className="fw-bold mb-1" style={{ color: "#0d3a5c" }}>Delete Chapter?</h6>
          <p className="text-muted small mb-0">
            <strong>{chapter.name}</strong> will be soft-deleted.
          </p>
        </div>
        <div className="modal-footer border-0 pt-0 pb-3 px-4 d-flex gap-2 justify-content-center">
          <button className="btn btn-outline-secondary rounded-3" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button className="btn btn-danger rounded-3" onClick={onConfirm} disabled={deleting}>
            {deleting ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Quick Add (Board / Class / Subject) ───────────────────────────────────
// Create-only, no edit/delete — lets an admin add a new Board/Class/Subject
// inline while setting up curriculum, instead of being blocked on someone
// seeding one by hand first. Deliberately minimal (just a name + one
// optional field) rather than a full separate CRUD page for each.

const QUICK_ADD_LABELS = {
  board: { title: "Add Board", namePlaceholder: "e.g. CBSE", codePlaceholder: "e.g. CBSE" },
  class: { title: "Add Class", namePlaceholder: "e.g. Class 9" },
  subject: { title: "Add Subject", namePlaceholder: "e.g. Mathematics", codePlaceholder: "e.g. MATH" },
};

const QuickAddModal = ({ type, onSave, onClose, saving, errorMessage, onClearError }) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const labels = QUICK_ADD_LABELS[type];

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { name: name.trim() };
    if (type === "board" || type === "subject") payload.code = code.trim() || null;
    if (type === "class") payload.grade_level = gradeLevel ? Number(gradeLevel) : null;
    onSave(payload);
  };

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-sm">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-0 rounded-top-4 px-4 py-3" style={{ background: BRAND }}>
            <h6 className="modal-title fw-bold text-white mb-0">{labels.title}</h6>
            <button className="btn-close btn-close-white ms-auto" onClick={onClose} disabled={saving}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body px-4 py-3">
              {errorMessage ? (
                <div className="alert alert-danger border-0 rounded-3 py-2 px-3 mb-3 small">{errorMessage}</div>
              ) : null}
              <div className="mb-3">
                <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                  Name <span className="text-danger">*</span>
                </label>
                <input
                  className="form-control rounded-3"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMessage && onClearError) onClearError();
                  }}
                  required
                  placeholder={labels.namePlaceholder}
                  autoFocus
                />
              </div>
              {(type === "board" || type === "subject") && (
                <div className="mb-3">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>Code</label>
                  <input
                    className="form-control rounded-3"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={labels.codePlaceholder}
                  />
                </div>
              )}
              {type === "class" && (
                <div className="mb-3">
                  <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>Grade Level</label>
                  <input
                    type="number"
                    className="form-control rounded-3"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    placeholder="e.g. 9"
                  />
                </div>
              )}
            </div>
            <div className="modal-footer border-0 px-4 pb-4">
              <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn text-white rounded-3 px-4" style={{ background: BRAND }} disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-2"></span> : <FaCheck className="me-2" />}
                Add
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Process Chapter Modal ──────────────────────────────────────────────────

// Ordered so a dependent step always renders after what it needs —
// purely a display nicety, dependency enforcement itself is the
// `requires` field below plus the matching expansion the server does
// independently in processChapterService (this is a convenience default,
// not the source of truth).
const PROCESS_STEPS = [
  { id: "text", label: "Ingest Text", requires: [] },
  { id: "images", label: "Ingest Images", requires: [] },
  { id: "enrich", label: "Enrich Images", requires: ["images"] },
  { id: "mindmap", label: "Generate Mind Map", requires: ["text"] },
  { id: "slidedeck", label: "Generate Slide Deck", requires: ["text"] },
  { id: "infographic", label: "Generate Infographic", requires: ["text"] },
];

// Badge styling matches IngestionMonitor.jsx's own STATUS_STYLE, kept in
// sync by hand — see that file's comment on why it's not a shared import.
const GENERATION_STATUS_STYLE = {
  completed: { bg: "rgba(22,163,74,0.12)", color: "#16a34a", label: "Completed" },
  processing: { bg: "rgba(37,99,235,0.12)", color: "#2563eb", label: "Processing" },
  pending: { bg: "rgba(100,116,139,0.14)", color: "#64748b", label: "Pending" },
  failed: { bg: "rgba(220,38,38,0.12)", color: "#dc2626", label: "Failed" },
};

// Mind map is 5 variant rows, not one — collapse to a single badge so it
// reads the same as slide deck/infographic's plain `status` field: any
// failed variant surfaces as "failed" (even if others completed) since
// that's exactly the case this modal's retry needs to surface.
const summarizeMindMapStatus = (variants) => {
  if (!variants || variants.length === 0) return null;
  if (variants.some((v) => v.status === "failed")) return "failed";
  if (variants.every((v) => v.status === "completed")) return "completed";
  if (variants.some((v) => v.status === "processing" || v.status === "pending")) return "processing";
  return null;
};

const GenerationStatusBadge = ({ status }) => {
  const style = GENERATION_STATUS_STYLE[status];
  if (!style) return null;
  return (
    <span
      className="badge rounded-pill px-2 py-1 ms-1"
      style={{ background: style.bg, color: style.color, fontWeight: 600, fontSize: "0.65rem" }}
    >
      {style.label}
    </span>
  );
};

const ProcessChapterModal = ({ chapter, onSubmit, onClose, uploading, errorMessage, onClearError }) => {
  const [file, setFile] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  // Read-only snapshot of what's already there, so a "Failed" badge tells
  // the admin exactly which of mindmap/slidedeck/infographic needs
  // retrying before they blindly re-check everything. Fetched once on
  // open — the modal is short-lived, no need to poll it.
  const [genStatus, setGenStatus] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getGenerationStatus(chapter.chapter_id)
      .then((data) => {
        if (!cancelled) setGenStatus(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chapter.chapter_id]);

  const toggleStep = (stepId) => {
    if (errorMessage && onClearError) onClearError();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
        // Also drop anything that directly required this step — leaving
        // it checked would just fail server-side with nothing to run it
        // against.
        PROCESS_STEPS.forEach((s) => {
          if (s.requires.includes(stepId)) next.delete(s.id);
        });
      } else {
        next.add(stepId);
        // Silently pull in prerequisites rather than blocking the click
        // — matches the same automatic chaining the backend does.
        const step = PROCESS_STEPS.find((s) => s.id === stepId);
        step?.requires.forEach((r) => next.add(r));
      }
      return next;
    });
  };

  const selectAll = () => {
    if (errorMessage && onClearError) onClearError();
    setSelected(new Set(PROCESS_STEPS.map((s) => s.id)));
  };

  const fileRequired = selected.has("text") || selected.has("images");
  const canSubmit = selected.size > 0 && (!fileRequired || !!file);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(Array.from(selected), file);
  };

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-0 rounded-top-4 px-4 py-3" style={{ background: BRAND }}>
            <div>
              <h6 className="modal-title fw-bold text-white mb-0">
                <FaCloudUploadAlt className="me-2" />
                Process Chapter
              </h6>
              <small className="text-white opacity-75">
                {chapter.name}
                {chapter.academic_year ? ` · ${chapter.academic_year}` : ""}
              </small>
            </div>
            <button className="btn-close btn-close-white ms-auto" onClick={onClose} disabled={uploading}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body px-4 py-3">
              {errorMessage ? (
                <div className="alert alert-danger border-0 rounded-3 py-2 px-3 mb-3 small">{errorMessage}</div>
              ) : null}

              <div className="d-flex align-items-center justify-content-between mb-2">
                <label className="form-label fw-semibold small mb-0" style={{ color: "#0d3a5c" }}>
                  What do you want to run?
                </label>
                <button type="button" className="btn btn-sm btn-outline-secondary rounded-3" onClick={selectAll}>
                  All
                </button>
              </div>
              <div className="d-flex flex-column gap-1 mb-3">
                {PROCESS_STEPS.map((step) => (
                  <label key={step.id} className="d-flex align-items-center gap-2 small" style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={selected.has(step.id)}
                      onChange={() => toggleStep(step.id)}
                    />
                    {step.label}
                    {step.requires.length > 0 && (
                      <span className="text-muted">(needs {step.requires.map((r) => PROCESS_STEPS.find((s) => s.id === r)?.label).join(", ")})</span>
                    )}
                    {step.id === "mindmap" && (
                      <GenerationStatusBadge status={summarizeMindMapStatus(genStatus?.mindmap?.variants)} />
                    )}
                    {step.id === "slidedeck" && <GenerationStatusBadge status={genStatus?.slidedeck?.status} />}
                    {step.id === "infographic" && <GenerationStatusBadge status={genStatus?.infographic?.status} />}
                  </label>
                ))}
              </div>

              <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
                Chapter PDF {fileRequired && <span className="text-danger">*</span>}
              </label>
              <input
                type="file"
                accept="application/pdf"
                className="form-control rounded-3"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  if (errorMessage && onClearError) onClearError();
                }}
                disabled={!fileRequired && selected.size > 0}
                required={fileRequired}
              />
              <p className="text-muted small mt-2 mb-0">
                {fileRequired
                  ? "Required for text/image ingestion — chunked/embedded (text) or run through layout+vision extraction (images) in the background."
                  : "No file needed — enrichment and mind map/slide deck generation both run against content that's already been ingested."}
              </p>
            </div>
            <div className="modal-footer border-0 px-4 pb-4">
              <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose} disabled={uploading}>
                Cancel
              </button>
              <button type="submit" className="btn text-white rounded-3 px-4" style={{ background: BRAND }} disabled={uploading || !canSubmit}>
                {uploading ? <span className="spinner-border spinner-border-sm me-2"></span> : <FaUpload className="me-2" />}
                Start
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Main Curriculum List Component ────────────────────────────────────────

const CurriculumList = () => {
  const { can, loading: rbacLoading } = useRBAC();

  const canCreate = can(["curriculum_management", "curriculum"], "create");
  const canUpdate = can(["curriculum_management", "curriculum"], "update");
  const canDelete = can(["curriculum_management", "curriculum"], "delete");

  const [boards, setBoards] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [boardFilter, setBoardFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");

  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editChapter, setEditChapter] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [quickAddType, setQuickAddType] = useState(null); // "board" | "class" | "subject" | null
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState("");

  const [ingestTarget, setIngestTarget] = useState(null);
  const [ingestUploading, setIngestUploading] = useState(false);
  const [ingestError, setIngestError] = useState("");

  const [showMonitor, setShowMonitor] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    getAcademicBoards()
      .then((data) => setBoards(data))
      .catch((err) => showToast(getApiErrorMessage(err, "Failed to load boards."), "error"));
  }, []);

  // Classes/Subjects re-fetch scoped to the selected Board (board-agnostic
  // rows still come back too — see getClassesService/getSubjectsService on
  // the backend). Falls back to the first available option whenever the
  // currently selected one isn't in the new list (e.g. after switching boards).
  useEffect(() => {
    getAcademicClasses(boardFilter ? { board_id: boardFilter } : {})
      .then((data) => {
        setClasses(data);
        setClassFilter((prev) =>
          data.some((c) => String(c.class_id) === prev) ? prev : data[0] ? String(data[0].class_id) : ""
        );
      })
      .catch((err) => showToast(getApiErrorMessage(err, "Failed to load classes."), "error"));
  }, [boardFilter]);

  // Also scoped by Class — a subject created with a specific class_id (see
  // handleQuickAdd) should only show up while that class is selected;
  // class-agnostic subjects (class_id null) always show regardless, per
  // getSubjectsService's OR-inclusive filtering on the backend.
  // include_inactive: true — the admin screen must still show/manage a
  // deactivated subject (to reactivate it later); only student-facing
  // callers get the default active-only list.
  const fetchSubjects = useCallback(() => {
    return getAcademicSubjects({
      ...(boardFilter && { board_id: boardFilter }),
      ...(classFilter && { class_id: classFilter }),
      include_inactive: true,
    }).then((data) => {
      setSubjects(data);
      setSubjectFilter((prev) =>
        data.some((s) => String(s.subject_id) === prev) ? prev : data[0] ? String(data[0].subject_id) : ""
      );
      return data;
    });
  }, [boardFilter, classFilter]);

  useEffect(() => {
    fetchSubjects().catch((err) => showToast(getApiErrorMessage(err, "Failed to load subjects."), "error"));
  }, [fetchSubjects]);

  const handleToggleSubjectActive = async () => {
    if (!selectedSubject) return;
    const nextActive = !selectedSubject.is_active;
    try {
      await updateAcademicSubject(selectedSubject.subject_id, { is_active: nextActive });
      await fetchSubjects();
      showToast(`${selectedSubject.name} is now ${nextActive ? "visible to" : "hidden from"} students.`);
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to update subject."), "error");
    }
  };

  const fetchChapters = useCallback(async () => {
    if (!subjectFilter || !classFilter) return;
    setLoading(true);
    try {
      const data = await getChapters({ subject_id: subjectFilter, class_id: classFilter });
      setChapters(data);
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to load chapters."), "error");
    } finally {
      setLoading(false);
    }
  }, [subjectFilter, classFilter]);

  useEffect(() => { fetchChapters(); }, [fetchChapters]);

  const filteredChapters = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return chapters;
    return chapters.filter((chapter) => {
      const name = (chapter.name || "").toLowerCase();
      const sourceFile = (chapter.source_file || "").toLowerCase();
      return name.includes(term) || sourceFile.includes(term);
    });
  }, [chapters, search]);

  const subjectName = (id) => subjects.find((s) => String(s.subject_id) === String(id))?.name || "—";
  const selectedSubject = subjects.find((s) => String(s.subject_id) === String(subjectFilter));
  const className = (id) => classes.find((c) => String(c.class_id) === String(id))?.name || "—";

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editChapter) {
        await updateChapter(editChapter.chapter_id, payload);
        showToast("Chapter updated successfully.");
      } else {
        await createChapter(payload);
        showToast("Chapter created successfully.");
      }
      setFormError("");
      setShowForm(false);
      setEditChapter(null);
      fetchChapters();
    } catch (err) {
      const message = getApiErrorMessage(err, "Failed to save chapter.");
      setFormError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteChapter(deleteTarget.chapter_id);
      showToast("Chapter deactivated.");
      setDeleteTarget(null);
      fetchChapters();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to delete chapter."), "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleQuickAdd = async (payload) => {
    setQuickAddSaving(true);
    try {
      if (quickAddType === "board") {
        const board = await createAcademicBoard(payload);
        setBoards((prev) => [...prev, board]);
        setBoardFilter(String(board.board_id));
      } else if (quickAddType === "class") {
        const klass = await createAcademicClass({ ...payload, board_id: boardFilter ? Number(boardFilter) : null });
        const data = await getAcademicClasses(boardFilter ? { board_id: boardFilter } : {});
        setClasses(data);
        setClassFilter(String(klass.class_id));
      } else if (quickAddType === "subject") {
        // class_id is set to the currently selected class, so "Add Subject"
        // while Class 9 is selected creates a subject scoped to Class 9
        // specifically. Leave Class filter on "— Select Class —" first if
        // this subject should instead be shared across every class.
        const subject = await createAcademicSubject({
          ...payload,
          board_id: boardFilter ? Number(boardFilter) : null,
          class_id: classFilter ? Number(classFilter) : null,
        });
        await fetchSubjects();
        setSubjectFilter(String(subject.subject_id));
      }
      showToast(`${quickAddType.charAt(0).toUpperCase()}${quickAddType.slice(1)} added successfully.`);
      setQuickAddType(null);
      setQuickAddError("");
    } catch (err) {
      setQuickAddError(getApiErrorMessage(err, `Failed to add ${quickAddType}.`));
    } finally {
      setQuickAddSaving(false);
    }
  };

  const handleProcessSubmit = async (steps, file) => {
    setIngestUploading(true);
    try {
      await processChapter(ingestTarget.chapter_id, steps, file);
      showToast("Processing started — check the Ingestion Monitor for progress.");
      setIngestTarget(null);
      setIngestError("");
    } catch (err) {
      setIngestError(getApiErrorMessage(err, "Failed to start processing."));
    } finally {
      setIngestUploading(false);
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
    <div className="container-fluid py-4 px-3 px-md-4">
      <ToastMessage toast={toast} />

      {showForm && (
        <ChapterFormModal
          chapter={editChapter}
          subjects={subjects}
          classes={classes}
          defaultSubjectId={subjectFilter}
          defaultClassId={classFilter}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditChapter(null);
            setFormError("");
          }}
          saving={saving}
          errorMessage={formError}
          onClearError={() => setFormError("")}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          chapter={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {quickAddType && (
        <QuickAddModal
          type={quickAddType}
          onSave={handleQuickAdd}
          onClose={() => {
            setQuickAddType(null);
            setQuickAddError("");
          }}
          saving={quickAddSaving}
          errorMessage={quickAddError}
          onClearError={() => setQuickAddError("")}
        />
      )}

      {ingestTarget && (
        <ProcessChapterModal
          chapter={ingestTarget}
          onSubmit={handleProcessSubmit}
          onClose={() => {
            setIngestTarget(null);
            setIngestError("");
          }}
          uploading={ingestUploading}
          errorMessage={ingestError}
          onClearError={() => setIngestError("")}
        />
      )}

      {showMonitor && <IngestionMonitor subjects={subjects} onClose={() => setShowMonitor(false)} />}

      {/* Header */}
      <div
        className="rounded-4 mb-4 p-4 text-white position-relative"
        style={{ background: BRAND }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h4 className="fw-bold mb-1">
              <FaBook className="me-2" />
              Curriculum Management
            </h4>
            <p className="mb-0 opacity-75 small">Manage chapters per subject and class.</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-light rounded-3 px-3 d-flex align-items-center gap-2 fw-semibold"
              onClick={() => setShowMonitor(true)}
            >
              <FaListUl />
              Ingestion Monitor
            </button>
            {canCreate && (
              <button
                className="btn btn-light rounded-3 px-4 d-flex align-items-center gap-2 fw-semibold"
                disabled={!subjectFilter || !classFilter}
                onClick={() => {
                  setEditChapter(null);
                  setFormError("");
                  setShowForm(true);
                }}
                style={{ color: "#0d3a5c" }}
              >
                <FaPlus />
                Add Chapter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card border-0 rounded-4 mb-4 shadow-sm">
        <div className="card-body py-3 px-4">
          <div className="row g-2 align-items-center mb-2">
            <div className="col-12 col-md-6">
              <div className="input-group rounded-3 overflow-hidden">
                <span className="input-group-text bg-white border-0 text-muted">
                  <FaSearch />
                </span>
                <input
                  className="form-control border-0 shadow-none"
                  placeholder="Search chapters..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="btn btn-link text-muted border-0 px-2" onClick={() => setSearch("")}>
                    <FaTimes />
                  </button>
                )}
              </div>
            </div>
            <div className="col-12 col-md-6">
              <div className="input-group rounded-3">
                <select
                  className="form-select rounded-start-3"
                  value={boardFilter}
                  onChange={(e) => setBoardFilter(e.target.value)}
                >
                  <option value="">— All Boards —</option>
                  {boards.map((b) => (
                    <option key={b.board_id} value={b.board_id}>{b.name}</option>
                  ))}
                </select>
                {canCreate && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    title="Add Board"
                    onClick={() => setQuickAddType("board")}
                  >
                    <FaPlus />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="row g-2 align-items-center">
            <div className="col-6 col-md-6">
              <div className="input-group rounded-3">
                <select
                  className="form-select rounded-start-3"
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                >
                  <option value="">— Select Subject —</option>
                  {subjects.map((s) => (
                    <option key={s.subject_id} value={s.subject_id}>
                      {s.name}
                      {!s.is_active ? " (Inactive)" : ""}
                    </option>
                  ))}
                </select>
                {canUpdate && selectedSubject && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    title={selectedSubject.is_active ? "Hide this subject from students" : "Show this subject to students"}
                    onClick={handleToggleSubjectActive}
                  >
                    {selectedSubject.is_active ? <FaCheckCircle className="text-success" /> : <FaMinusCircle className="text-secondary" />}
                  </button>
                )}
                {canCreate && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    title="Add Subject"
                    onClick={() => setQuickAddType("subject")}
                  >
                    <FaPlus />
                  </button>
                )}
              </div>
            </div>
            <div className="col-6 col-md-6">
              <div className="input-group rounded-3">
                <select
                  className="form-select rounded-start-3"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                >
                  <option value="">— Select Class —</option>
                  {classes.map((c) => (
                    <option key={c.class_id} value={c.class_id}>{c.name}</option>
                  ))}
                </select>
                {canCreate && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    title="Add Class"
                    onClick={() => setQuickAddType("class")}
                  >
                    <FaPlus />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 rounded-4 shadow-sm">
        {!subjectFilter || !classFilter ? (
          <div className="text-center py-5">
            <FaBook className="fs-1 text-muted opacity-40" />
            <p className="text-muted mt-2">Select a subject and class to view chapters.</p>
          </div>
        ) : loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color: "#1a709b" }}></div>
            <p className="text-muted mt-2 small">Loading chapters...</p>
          </div>
        ) : filteredChapters.length === 0 ? (
          <div className="text-center py-5">
            <FaBook className="fs-1 text-muted opacity-40" />
            <p className="text-muted mt-2">No chapters found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th className="px-4 py-3 fw-semibold small" style={{ color: "#64748b" }}>Order</th>
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Chapter Name</th>
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Section</th>
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Subject</th>
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Class</th>
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Source File</th>
                  <th className="py-3 fw-semibold small" style={{ color: "#64748b" }}>Academic Year</th>
                  <th className="py-3 fw-semibold small text-center" style={{ color: "#64748b" }}>Status</th>
                  <th className="py-3 fw-semibold small text-end pe-4" style={{ color: "#64748b" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredChapters.map((chapter) => (
                  <tr key={chapter.chapter_id}>
                    <td className="px-4 text-muted small">{chapter.chapter_order}</td>
                    <td className="fw-semibold" style={{ color: "#1e293b" }}>{chapter.name}</td>
                    <td className="text-muted small text-capitalize">{chapter.content_type || "—"}</td>
                    <td className="text-muted small">{subjectName(chapter.subject_id)}</td>
                    <td className="text-muted small">{className(chapter.class_id)}</td>
                    <td>
                      <code className="small" style={{ color: "#1a709b" }}>{chapter.source_file}</code>
                    </td>
                    <td className="text-muted small">{chapter.academic_year || "—"}</td>
                    <td className="text-center">
                      <StatusBadge active={chapter.is_active !== false} />
                    </td>
                    <td className="text-end pe-4">
                      <div className="d-flex justify-content-end gap-1">
                        {canUpdate && (
                          <button
                            className="btn btn-sm btn-light rounded-3"
                            onClick={() => {
                              setIngestTarget(chapter);
                              setIngestError("");
                            }}
                            title="Process Chapter"
                          >
                            <FaUpload />
                          </button>
                        )}
                        {canUpdate && (
                          <button
                            className="btn btn-sm btn-light rounded-3"
                            onClick={() => {
                              setEditChapter(chapter);
                              setFormError("");
                              setShowForm(true);
                            }}
                            title="Edit"
                          >
                            <FaPencilAlt />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="btn btn-sm btn-light text-danger rounded-3"
                            onClick={() => setDeleteTarget(chapter)}
                            title="Delete"
                          >
                            <FaTrashAlt />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CurriculumList;
