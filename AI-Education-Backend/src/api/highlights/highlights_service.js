import { EducationChapterHighlight } from "./highlights_schema.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";
import { resolveStudentClassId } from "../curriculum/curriculum_service.js";
import { createEducationError } from "../education_errors.js";

const requireStudentProfileId = async (userId) => {
  const scope = await resolveStudentClassId(userId);
  if (!scope) throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  return scope.studentProfileId;
};

export const listHighlightsService = async (userId, { chapterId }) => {
  const studentProfileId = await requireStudentProfileId(userId);

  return EducationChapterHighlight.findAll({
    where: { student_profile_id: studentProfileId, chapter_id: chapterId },
    order: [["created_at", "ASC"]],
  });
};

export const createHighlightService = async (userId, { chapterId, pageIndex, text, color }) => {
  const studentProfileId = await requireStudentProfileId(userId);

  const chapter = await EducationChapter.findOne({ where: { chapter_id: chapterId, is_active: true } });
  if (!chapter) throw createEducationError("Chapter not found", 404, "CHAPTER_NOT_FOUND");

  return EducationChapterHighlight.create({
    student_profile_id: studentProfileId,
    chapter_id: chapterId,
    page_index: pageIndex,
    text,
    color,
  });
};

export const deleteHighlightService = async (userId, highlightId) => {
  const studentProfileId = await requireStudentProfileId(userId);

  const highlight = await EducationChapterHighlight.findOne({
    where: { highlight_id: highlightId, student_profile_id: studentProfileId },
  });
  if (!highlight) throw createEducationError("Highlight not found", 404, "HIGHLIGHT_NOT_FOUND");

  await highlight.destroy();
};
