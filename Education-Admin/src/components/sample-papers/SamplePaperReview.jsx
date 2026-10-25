import { useEffect, useState } from "react";
import {
  getSamplePaper,
  updateSamplePaperQuestion,
  draftAnswerForQuestion,
  approveSamplePaperQuestion,
  publishSamplePaper,
} from "../../services/samplePaperService.js";
import { getApiErrorMessage } from "../../services/errorMessage.js";
import ToastMessage from "../../shared/component/ToastMessage.jsx";
import {
  FaArrowLeft,
  FaCheck,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPlus,
  FaTimes,
  FaCloudUploadAlt,
  FaRobot,
} from "react-icons/fa";

const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";

const QUESTION_TYPES = ["short_answer", "long_answer", "numerical", "diagram_based"];
const INPUT_TYPES = ["typed", "photo", "typed_or_photo"];
const GRADING_STRATEGIES = ["exact", "numeric", "rubric", "handwriting_rubric", "diagram_rubric", "graph_rubric"];
const QUESTION_MEDIA = ["none", "image"];

const REVIEW_STATUS_STYLE = {
  ai_extracted: { bg: "rgba(217,119,6,0.12)", color: "#d97706", label: "AI Extracted" },
  admin_edited: { bg: "rgba(37,99,235,0.12)", color: "#2563eb", label: "Edited" },
  approved: { bg: "rgba(22,163,74,0.12)", color: "#16a34a", label: "Approved" },
};

const Badge = ({ style }) => (
  <span
    className="badge rounded-pill px-3 py-2"
    style={{ background: style.bg, color: style.color, fontWeight: 600, fontSize: "0.72rem", border: `1px solid ${style.color}33` }}
  >
    {style.label}
  </span>
);

const rubricSum = (criteria) => (criteria || []).reduce((s, c) => s + (Number(c.marks) || 0), 0);

const QuestionCard = ({ question, onSaved, onApproved, showToast }) => {
  const [form, setForm] = useState({
    question_text: question.question_text || "",
    question_type: question.question_type,
    question_media: question.question_media || "none",
    input_type: question.input_type,
    grading_strategy: question.grading_strategy,
    max_marks: question.max_marks,
    model_answer: question.model_answer || "",
    rubric_criteria: question.rubric_criteria || [],
    rubric_notes: question.rubric_notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [answerSource, setAnswerSource] = useState(question.answer_source);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
    if (error) setError("");
  };

  const setRubricRow = (index, key, value) => {
    const next = form.rubric_criteria.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    set("rubric_criteria", next);
  };
  const addRubricRow = () => set("rubric_criteria", [...form.rubric_criteria, { criterion: "", marks: 0 }]);
  const removeRubricRow = (index) => set("rubric_criteria", form.rubric_criteria.filter((_, i) => i !== index));

  const sum = rubricSum(form.rubric_criteria);
  const marksMismatch = form.rubric_criteria.length > 0 && sum !== Number(form.max_marks);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await updateSamplePaperQuestion(question.question_id, {
        ...form,
        max_marks: Number(form.max_marks),
        rubric_criteria: form.rubric_criteria.length > 0 ? form.rubric_criteria : null,
      });
      setDirty(false);
      onSaved();
      showToast("Question saved.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save question."));
    } finally {
      setSaving(false);
    }
  };

  const handleDraftAnswer = async () => {
    setDrafting(true);
    setError("");
    try {
      const updated = await draftAnswerForQuestion(question.question_id);
      setForm((f) => ({
        ...f,
        model_answer: updated.model_answer || "",
        rubric_criteria: updated.rubric_criteria || [],
      }));
      setAnswerSource(updated.answer_source);
      setDirty(false);
      onSaved();
      showToast("Draft answer generated — review it before approving.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to draft an answer."));
    } finally {
      setDrafting(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    setError("");
    try {
      if (dirty) await handleSave();
      await approveSamplePaperQuestion(question.question_id);
      onApproved();
      showToast(`Question ${question.question_order} approved.`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to approve question."));
    } finally {
      setApproving(false);
    }
  };

  const isApproved = question.review_status === "approved" && !dirty;

  return (
    <div className="card border-0 rounded-4 shadow-sm mb-3">
      <div className="card-body p-4">
        <div className="d-flex align-items-start justify-content-between mb-3 gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold" style={{ color: "#0d3a5c" }}>Q{question.question_order}</span>
            <Badge style={REVIEW_STATUS_STYLE[dirty ? "admin_edited" : question.review_status] || REVIEW_STATUS_STYLE.ai_extracted} />
            {answerSource === "rag_drafted" && (
              <span className="badge rounded-pill px-3 py-2 small" style={{ background: "rgba(217,119,6,0.12)", color: "#d97706" }}>
                <FaRobot className="me-1" />
                AI-drafted — not from the teacher's solution
              </span>
            )}
            {answerSource === "unmatched" && !form.model_answer && (
              <span className="badge rounded-pill px-3 py-2 small" style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626" }}>
                <FaExclamationTriangle className="me-1" />
                No matching solution found — needs a manual answer
              </span>
            )}
          </div>
          {answerSource !== "solution_matched" && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary rounded-3"
              onClick={handleDraftAnswer}
              disabled={drafting}
              title="Draft an answer via RAG, grounded in the ingested textbook content — review before approving"
            >
              {drafting ? <span className="spinner-border spinner-border-sm me-1"></span> : <FaRobot className="me-1" />}
              Draft Answer (AI)
            </button>
          )}
        </div>

        {error && (
          <div className="alert alert-danger border-0 rounded-3 py-2 px-3 mb-3 small">{error}</div>
        )}

        <div className="mb-3">
          <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>Question Text</label>
          <textarea
            className="form-control rounded-3"
            rows={3}
            value={form.question_text}
            onChange={(e) => set("question_text", e.target.value)}
          />
        </div>

        <div className="row g-3 mb-3">
          <div className="col-6 col-md-2">
            <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>Marks</label>
            <input
              type="number"
              className="form-control rounded-3"
              value={form.max_marks}
              onChange={(e) => set("max_marks", e.target.value)}
              min={1}
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>Question Type</label>
            <select className="form-select rounded-3" value={form.question_type} onChange={(e) => set("question_type", e.target.value)}>
              {QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>Input Type</label>
            <select className="form-select rounded-3" value={form.input_type} onChange={(e) => set("input_type", e.target.value)}>
              {INPUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>Media</label>
            <select className="form-select rounded-3" value={form.question_media} onChange={(e) => set("question_media", e.target.value)}>
              {QUESTION_MEDIA.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>Grading Strategy</label>
            <select className="form-select rounded-3" value={form.grading_strategy} onChange={(e) => set("grading_strategy", e.target.value)}>
              {GRADING_STRATEGIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold small" style={{ color: "#0d3a5c" }}>
            Model Answer {!form.model_answer && <span className="text-danger">(required before approval)</span>}
          </label>
          <textarea
            className="form-control rounded-3"
            rows={3}
            value={form.model_answer}
            onChange={(e) => set("model_answer", e.target.value)}
            placeholder="The real answer, from the Solution PDF (or filled in manually if unmatched)"
          />
        </div>

        <div className="mb-2">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <label className="form-label fw-semibold small mb-0" style={{ color: "#0d3a5c" }}>
              Rubric Criteria {form.rubric_criteria.length > 0 && (
                <span className={marksMismatch ? "text-danger" : "text-success"}>
                  (sums to {sum} / {form.max_marks} marks{marksMismatch ? " — mismatch" : ""})
                </span>
              )}
            </label>
            <button type="button" className="btn btn-sm btn-outline-secondary rounded-3" onClick={addRubricRow}>
              <FaPlus className="me-1" /> Add
            </button>
          </div>
          {form.rubric_criteria.map((row, i) => (
            <div key={i} className="d-flex gap-2 mb-2">
              <input
                className="form-control form-control-sm rounded-3"
                placeholder="Criterion"
                value={row.criterion}
                onChange={(e) => setRubricRow(i, "criterion", e.target.value)}
              />
              <input
                type="number"
                className="form-control form-control-sm rounded-3"
                style={{ maxWidth: 90 }}
                value={row.marks}
                onChange={(e) => setRubricRow(i, "marks", Number(e.target.value))}
                min={0}
              />
              <button type="button" className="btn btn-sm btn-light text-danger rounded-3" onClick={() => removeRubricRow(i)}>
                <FaTimes />
              </button>
            </div>
          ))}
        </div>

        <div className="d-flex justify-content-end gap-2 mt-3">
          <button className="btn btn-outline-secondary rounded-3" onClick={handleSave} disabled={saving || approving || !dirty}>
            {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
            Save
          </button>
          <button
            className="btn text-white rounded-3 px-3"
            style={{ background: isApproved ? "#16a34a" : BRAND }}
            onClick={handleApprove}
            disabled={approving || saving || isApproved}
          >
            {approving ? <span className="spinner-border spinner-border-sm me-1"></span> : <FaCheckCircle className="me-1" />}
            {isApproved ? "Approved" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SamplePaperReview = ({ samplePaperId, onBack, onPublished }) => {
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 4000);
  };

  const fetchPaper = async () => {
    setLoading(true);
    try {
      const data = await getSamplePaper(samplePaperId);
      setPaper(data);
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to load sample paper."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPaper(); }, [samplePaperId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError("");
    try {
      await publishSamplePaper(samplePaperId);
      await fetchPaper();
      onPublished?.();
    } catch (err) {
      setPublishError(getApiErrorMessage(err, "Failed to publish."));
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border" style={{ color: "#1a709b" }}></div>
      </div>
    );
  }
  if (!paper) return null;

  const questions = [...(paper.questions || [])].sort((a, b) => a.question_order - b.question_order);
  const approvedCount = questions.filter((q) => q.review_status === "approved").length;
  const allApproved = questions.length > 0 && approvedCount === questions.length;

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      <ToastMessage toast={toast} />

      <div className="rounded-4 mb-4 p-4 text-white position-relative" style={{ background: BRAND }}>
        <button className="btn btn-sm btn-light rounded-3 mb-3" onClick={onBack} style={{ color: "#0d3a5c" }}>
          <FaArrowLeft className="me-2" />
          Back to Sample Papers
        </button>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h4 className="fw-bold mb-1">{paper.title}</h4>
            <p className="mb-0 opacity-75 small">
              {approvedCount}/{questions.length} questions approved — confirm each matches the source PDF, not
              whether the answer is academically correct.
            </p>
          </div>
          <div className="text-end">
            {publishError && <p className="small text-warning mb-1">{publishError}</p>}
            {paper.status === "published" ? (
              <span className="badge rounded-pill px-3 py-2 bg-success">Published</span>
            ) : (
              <button
                className="btn btn-light rounded-3 px-4 fw-semibold"
                style={{ color: "#0d3a5c" }}
                onClick={handlePublish}
                disabled={!allApproved || publishing}
              >
                {publishing ? <span className="spinner-border spinner-border-sm me-2"></span> : <FaCloudUploadAlt className="me-2" />}
                Publish
              </button>
            )}
          </div>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="card border-0 rounded-4 shadow-sm text-center py-5">
          <FaExclamationTriangle className="fs-1 text-muted opacity-40" />
          <p className="text-muted mt-2">No questions extracted yet.</p>
        </div>
      ) : (
        questions.map((q) => (
          <QuestionCard
            key={q.question_id}
            question={q}
            onSaved={fetchPaper}
            onApproved={fetchPaper}
            showToast={showToast}
          />
        ))
      )}
    </div>
  );
};

export default SamplePaperReview;
