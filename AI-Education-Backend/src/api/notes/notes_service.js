import { EducationStudentNote } from "./notes_schema.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";
import { resolveStudentClassId } from "../curriculum/curriculum_service.js";
import { createEducationError } from "../education_errors.js";

const requireStudentProfileId = async (userId) => {
  const scope = await resolveStudentClassId(userId);
  if (!scope) throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  return scope.studentProfileId;
};

export const listNotesService = async (userId, { chapterId } = {}) => {
  const studentProfileId = await requireStudentProfileId(userId);
  const where = { student_profile_id: studentProfileId };
  if (chapterId) where.chapter_id = chapterId;

  return EducationStudentNote.findAll({
    where,
    include: [{ model: EducationChapter, as: "chapter", attributes: ["chapter_id", "name"] }],
    order: [["created_at", "DESC"]],
  });
};

export const createNoteService = async (userId, { chapterId, title, content, tags, addedByUserId = null }) => {
  const studentProfileId = await requireStudentProfileId(userId);

  if (chapterId) {
    const chapter = await EducationChapter.findOne({ where: { chapter_id: chapterId, is_active: true } });
    if (!chapter) throw createEducationError("Chapter not found", 404, "CHAPTER_NOT_FOUND");
  }

  return EducationStudentNote.create({
    student_profile_id: studentProfileId,
    chapter_id: chapterId || null,
    title,
    content,
    tags: tags || [],
    added_by_user_id: addedByUserId,
  });
};

export const updateNoteService = async (userId, noteId, { title, content, tags }) => {
  const studentProfileId = await requireStudentProfileId(userId);

  const note = await EducationStudentNote.findOne({ where: { note_id: noteId, student_profile_id: studentProfileId } });
  if (!note) throw createEducationError("Note not found", 404, "NOTE_NOT_FOUND");

  await note.update({
    ...(title !== undefined && { title }),
    ...(content !== undefined && { content }),
    ...(tags !== undefined && { tags }),
  });
  return note;
};

export const deleteNoteService = async (userId, noteId) => {
  const studentProfileId = await requireStudentProfileId(userId);

  const note = await EducationStudentNote.findOne({ where: { note_id: noteId, student_profile_id: studentProfileId } });
  if (!note) throw createEducationError("Note not found", 404, "NOTE_NOT_FOUND");

  await note.destroy();
};
