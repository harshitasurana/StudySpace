import {
  resolveStudentClassId,
  getChaptersService,
  createChapterService,
  updateChapterService,
  deleteChapterService,
  getProgressService,
  upsertProgressService,
  getChapterMetaService,
  streamChapterPdfService,
  streamNcertSolutionsPdfService,
  streamNcertNotesPdfService,
  getNcertSolutionsIndexService,
} from "./curriculum_service.js";
import { createEducationError } from "../education_errors.js";

/**
 * Resolves which subject_id/class_id to actually query with:
 * - Caller has a student profile: class_id is always their own class,
 *   resolved server-side — any class_id in the query string is ignored.
 * - Caller has no student profile (the Admin Curriculum Management screen):
 *   class_id is an explicit, trusted query param — staff manage every class.
 */
export const getChaptersController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const subjectId = Number(req.query.subject_id);

    const studentScope = await resolveStudentClassId(userId);
    const classId = studentScope ? studentScope.classId : Number(req.query.class_id);

    if (!classId || Number.isNaN(classId)) {
      throw createEducationError("class_id is required", 400, "CLASS_ID_REQUIRED");
    }

    const chapters = await getChaptersService({ subjectId, classId, includeNcertAvailability: req.query.include_ncert_availability });
    return res.status(200).json({ success: true, data: chapters });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch chapters" });
  }
};

export const createChapterController = async (req, res) => {
  try {
    const chapter = await createChapterService(req.body);
    return res.status(201).json({ success: true, message: "Chapter created successfully", data: chapter });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to create chapter" });
  }
};

export const updateChapterController = async (req, res) => {
  try {
    const chapter = await updateChapterService(req.params.id, req.body);
    return res.status(200).json({ success: true, message: "Chapter updated successfully", data: chapter });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to update chapter" });
  }
};

export const deleteChapterController = async (req, res) => {
  try {
    await deleteChapterService(req.params.id);
    return res.status(200).json({ success: true, message: "Chapter deactivated successfully" });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to delete chapter" });
  }
};

// studentProfileId in the URL must match the caller's own profile — a
// student can only ever read/write their own progress, regardless of what
// id they put in the request.
const assertOwnStudentProfile = async (req) => {
  const userId = req.user.user_id;
  const studentScope = await resolveStudentClassId(userId);

  if (!studentScope || String(studentScope.studentProfileId) !== String(req.params.studentProfileId)) {
    throw createEducationError("You may only access your own progress", 403, "FORBIDDEN_PROFILE_MISMATCH");
  }

  return studentScope.studentProfileId;
};

export const getProgressController = async (req, res) => {
  try {
    const studentProfileId = await assertOwnStudentProfile(req);
    const progress = await getProgressService(studentProfileId);
    return res.status(200).json({ success: true, data: progress });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch progress" });
  }
};

export const updateProgressController = async (req, res) => {
  try {
    const studentProfileId = await assertOwnStudentProfile(req);
    const { chapter_id, ...payload } = req.body;
    const progress = await upsertProgressService(studentProfileId, chapter_id, payload);
    return res.status(200).json({ success: true, message: "Progress updated successfully", data: progress });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to update progress" });
  }
};

export const getChapterMetaController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const chapterId = Number(req.params.chapterId);

    const meta = await getChapterMetaService(userId, chapterId);
    return res.status(200).json({ success: true, data: meta });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load chapter" });
  }
};

// Streams the real chapter PDF straight through to the browser — the
// reader renders it directly (react-pdf/pdf.js), not a transcribed
// version. response.data is a Node stream (axios responseType: 'stream'
// in ai_service_client.js's streamChapterPdf); piped rather than
// buffered so a large PDF doesn't sit fully in memory here first.
export const streamChapterPdfController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const chapterId = Number(req.params.chapterId);

    const aiResponse = await streamChapterPdfService(userId, chapterId);
    res.setHeader("Content-Type", "application/pdf");
    // A mid-transfer stream error (connection dropped after headers were
    // already sent) is otherwise an unhandled 'error' event — Node's
    // default behavior for that is to throw, which would crash the whole
    // process rather than just fail this one request.
    aiResponse.data.on("error", () => {
      if (!res.headersSent) res.status(502).json({ success: false, message: "Failed to load chapter PDF" });
      else res.end();
    });
    aiResponse.data.pipe(res);
  } catch (error) {
    const statusCode = error.statusCode || error.response?.status || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load chapter PDF" });
  }
};

// Same streaming shape as streamChapterPdfController, pointed at the
// real NCERT Solutions PDF instead. Not every chapter has one yet (pilot
// scope) — a 404 here is a normal "not available for this chapter" state
// for the frontend, not a failure.
export const streamNcertSolutionsPdfController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const chapterId = Number(req.params.chapterId);

    const aiResponse = await streamNcertSolutionsPdfService(userId, chapterId);
    res.setHeader("Content-Type", "application/pdf");
    aiResponse.data.on("error", () => {
      if (!res.headersSent) res.status(502).json({ success: false, message: "Failed to load NCERT Solutions PDF" });
      else res.end();
    });
    aiResponse.data.pipe(res);
  } catch (error) {
    const statusCode = error.statusCode || error.response?.status || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load NCERT Solutions PDF" });
  }
};

export const streamNcertNotesPdfController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const chapterId = Number(req.params.chapterId);

    const aiResponse = await streamNcertNotesPdfService(userId, chapterId);
    res.setHeader("Content-Type", "application/pdf");
    aiResponse.data.on("error", () => {
      if (!res.headersSent) res.status(502).json({ success: false, message: "Failed to load NCERT Notes PDF" });
      else res.end();
    });
    aiResponse.data.pipe(res);
  } catch (error) {
    const statusCode = error.statusCode || error.response?.status || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load NCERT Notes PDF" });
  }
};

export const getNcertSolutionsIndexController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const chapterId = Number(req.params.chapterId);

    const index = await getNcertSolutionsIndexService(userId, chapterId);
    return res.status(200).json({ success: true, data: index });
  } catch (error) {
    const statusCode = error.statusCode || error.response?.status || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "NCERT Solutions not available for this chapter" });
  }
};
