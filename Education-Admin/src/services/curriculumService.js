import { apiRequest } from "./axios";

const BASE = "/curriculum";

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

/**
 * subject_id and class_id are both required by the backend for a staff
 * (non-student) caller — the Admin screen must always pass both.
 */
export const getChapters = async (params = {}) => {
  const response = await apiRequest.get(`${BASE}/chapters`, { params });
  return unwrap(response) || [];
};

export const createChapter = async (data) => {
  const response = await apiRequest.post(`${BASE}/chapters`, data);
  return unwrap(response);
};

export const updateChapter = async (id, data) => {
  const response = await apiRequest.put(`${BASE}/chapters/${id}`, data);
  return unwrap(response);
};

export const deleteChapter = async (id) => {
  const response = await apiRequest.delete(`${BASE}/chapters/${id}`);
  return unwrap(response);
};

export const getAcademicBoards = async (params = {}) => {
  const response = await apiRequest.get("/academic/boards", { params });
  return unwrap(response) || [];
};

export const getAcademicClasses = async (params = {}) => {
  const response = await apiRequest.get("/academic/classes", { params });
  return unwrap(response) || [];
};

export const getAcademicSubjects = async (params = {}) => {
  const response = await apiRequest.get("/academic/subjects", { params });
  return unwrap(response) || [];
};

// Create-only (no edit/delete yet) — lets the admin add a new Board/Class/
// Subject inline while setting up curriculum, instead of being blocked on
// someone seeding one by hand first.
export const createAcademicBoard = async (data) => {
  const response = await apiRequest.post("/academic/boards", data);
  return unwrap(response);
};

export const createAcademicClass = async (data) => {
  const response = await apiRequest.post("/academic/classes", data);
  return unwrap(response);
};

export const createAcademicSubject = async (data) => {
  const response = await apiRequest.post("/academic/subjects", data);
  return unwrap(response);
};

// Active/inactive toggle — controls whether students see this subject at
// all (onboarding's subject picker, practice/chapter selectors, etc.).
export const updateAcademicSubject = async (id, data) => {
  const response = await apiRequest.put(`/academic/subjects/${id}`, data);
  return unwrap(response);
};

// Uploads a chapter's PDF and starts async ingestion (chunk/embed/store
// into Qdrant). Content-Type is explicitly cleared so axios sets the real
// multipart boundary itself instead of the instance's default
// "application/json" header (see axios.js).
export const ingestChapterPdf = async (chapterId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiRequest.post(`/admin/ingestion/chapters/${chapterId}/ingest`, formData, {
    headers: { "Content-Type": undefined },
  });
  return unwrap(response);
};

export const getIngestionJobs = async (params = {}) => {
  const response = await apiRequest.get("/admin/ingestion", { params });
  return unwrap(response) || [];
};

// The admin checklist's single entrypoint — any combination of
// text/images/enrich/mindmap/slidedeck/infographic for one chapter. file
// is optional (enrich/mindmap/slidedeck/infographic-only requests never
// carry one) — steps travels as a JSON string since multer only gives
// plain string fields on a multipart body.
export const processChapter = async (chapterId, steps, file) => {
  const formData = new FormData();
  formData.append("steps", JSON.stringify(steps));
  if (file) formData.append("file", file);
  const response = await apiRequest.post(`/admin/ingestion/chapters/${chapterId}/process`, formData, {
    headers: { "Content-Type": undefined },
  });
  return unwrap(response);
};

// Mind map / slide deck / infographic status for one chapter — these
// never get a row in the ingestion jobs list (getIngestionJobs) since
// they track their own tables, not education_book_ingestions.
export const getGenerationStatus = async (chapterId) => {
  const response = await apiRequest.get(`/admin/ingestion/chapters/${chapterId}/generation-status`);
  return unwrap(response);
};

// Ingestion Monitor's default view — one row per chapter (text/images/
// enrich/mindmap/slidedeck/infographic collapsed to their latest status
// each) instead of the raw per-attempt job list getIngestionJobs returns.
export const getChapterProcessingOverview = async (params = {}) => {
  const response = await apiRequest.get("/admin/ingestion/chapters-overview", { params });
  return unwrap(response);
};

// Only meaningful for an in-progress 'images' job (the long,
// vision-heavy one) — raises a flag the running Celery task polls once
// per page. Doesn't stop anything itself; the job's own status flips to
// 'paused' once it actually reports back.
export const pauseIngestionJob = async (jobId) => {
  const response = await apiRequest.post(`/admin/ingestion/${jobId}/pause`);
  return unwrap(response);
};

// Continues a 'paused' images job from its last completed page — needs
// the same PDF re-uploaded (this pipeline never persists the original
// upload anywhere Node can hand back on its own), same as any other
// re-run of an images job.
export const resumeIngestionJob = async (jobId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiRequest.post(`/admin/ingestion/${jobId}/resume`, formData, {
    headers: { "Content-Type": undefined },
  });
  return unwrap(response);
};

// Restarts a 'failed' or 'pending' job of any type. text/images need the
// same PDF re-uploaded (never persisted, same as resumeIngestionJob
// above) — pass file for those, omit it for enrich.
export const retryIngestionJob = async (jobId, file) => {
  if (file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiRequest.post(`/admin/ingestion/${jobId}/retry`, formData, {
      headers: { "Content-Type": undefined },
    });
    return unwrap(response);
  }
  const response = await apiRequest.post(`/admin/ingestion/${jobId}/retry`);
  return unwrap(response);
};

// Live CPU/GPU utilization from the AI service's machine — see
// core/system_resources.py (RAGProductionApp) via Node's proxy route.
export const getSystemResources = async () => {
  const response = await apiRequest.get("/admin/ingestion/system-resources");
  return unwrap(response);
};

export default {
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
  ingestChapterPdf,
  getIngestionJobs,
  processChapter,
  getGenerationStatus,
  getChapterProcessingOverview,
  pauseIngestionJob,
  resumeIngestionJob,
  retryIngestionJob,
  getSystemResources,
};
