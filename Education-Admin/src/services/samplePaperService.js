import { apiRequest } from "./axios";

const BASE = "/admin/sample-papers";

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

export const getSamplePapers = async (params = {}) => {
  const response = await apiRequest.get(BASE, { params });
  return unwrap(response) || [];
};

export const getSamplePaper = async (id) => {
  const response = await apiRequest.get(`${BASE}/${id}`);
  return unwrap(response);
};

export const createSamplePaper = async (data) => {
  const response = await apiRequest.post(BASE, data);
  return unwrap(response);
};

// Uploads both the real Paper and Solution PDFs and starts async
// extraction (read both -> match questions to real answers by number).
// Content-Type is explicitly cleared so axios sets the real multipart
// boundary itself, same as curriculumService.js's ingestChapterPdf.
export const extractSamplePaper = async (samplePaperId, paperFile, solutionFile) => {
  const formData = new FormData();
  formData.append("paper_file", paperFile);
  formData.append("solution_file", solutionFile);
  const response = await apiRequest.post(`${BASE}/${samplePaperId}/extract`, formData, {
    headers: { "Content-Type": undefined },
  });
  return unwrap(response);
};

export const getExtractionJobs = async (params = {}) => {
  const response = await apiRequest.get(`${BASE}/extraction-jobs`, { params });
  return unwrap(response) || [];
};

export const updateSamplePaperQuestion = async (questionId, data) => {
  const response = await apiRequest.put(`${BASE}/questions/${questionId}`, data);
  return unwrap(response);
};

// Fallback only — for a question extraction couldn't match to its real
// solution. Drafts via RAG, grounded in the ingested textbook content,
// never treated as equivalent to a real solution-sourced answer.
export const draftAnswerForQuestion = async (questionId) => {
  const response = await apiRequest.post(`${BASE}/questions/${questionId}/draft-answer`);
  return unwrap(response);
};

export const approveSamplePaperQuestion = async (questionId) => {
  const response = await apiRequest.post(`${BASE}/questions/${questionId}/approve`);
  return unwrap(response);
};

export const publishSamplePaper = async (samplePaperId) => {
  const response = await apiRequest.post(`${BASE}/${samplePaperId}/publish`);
  return unwrap(response);
};

export default {
  getSamplePapers,
  getSamplePaper,
  createSamplePaper,
  extractSamplePaper,
  getExtractionJobs,
  updateSamplePaperQuestion,
  draftAnswerForQuestion,
  approveSamplePaperQuestion,
  publishSamplePaper,
};
