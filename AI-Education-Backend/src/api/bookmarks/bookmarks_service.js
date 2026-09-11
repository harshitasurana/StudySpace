import { EducationStudentBookmark } from "./bookmarks_schema.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";
import { createEducationError } from "../education_errors.js";

// studentProfileId is resolved once by the requireStudentProfile
// middleware (req.studentScope.studentProfileId) — every function below
// takes it directly instead of re-deriving it from userId.

export const listBookmarksService = async (studentProfileId, { chapterId, collection } = {}) => {
  const where = { student_profile_id: studentProfileId };
  if (chapterId) where.chapter_id = chapterId;
  if (collection) where.collection = collection;

  return EducationStudentBookmark.findAll({
    where,
    include: [{ model: EducationChapter, as: "chapter", attributes: ["chapter_id", "name"] }],
    order: [["created_at", "DESC"]],
  });
};

export const createBookmarkService = async (studentProfileId, { chapterId, sourceType, title, content, collection, pageIndex, addedByUserId = null }) => {
  const chapter = await EducationChapter.findOne({ where: { chapter_id: chapterId, is_active: true } });
  if (!chapter) throw createEducationError("Chapter not found", 404, "CHAPTER_NOT_FOUND");

  return EducationStudentBookmark.create({
    student_profile_id: studentProfileId,
    chapter_id: chapterId,
    source_type: sourceType,
    title,
    content,
    collection: collection || null,
    page_index: pageIndex ?? null,
    added_by_user_id: addedByUserId,
  });
};

export const updateBookmarkService = async (studentProfileId, bookmarkId, { collection }) => {
  const bookmark = await EducationStudentBookmark.findOne({ where: { bookmark_id: bookmarkId, student_profile_id: studentProfileId } });
  if (!bookmark) throw createEducationError("Bookmark not found", 404, "BOOKMARK_NOT_FOUND");

  await bookmark.update({ collection: collection === undefined ? bookmark.collection : collection });
  return bookmark;
};

export const deleteBookmarkService = async (studentProfileId, bookmarkId) => {
  const bookmark = await EducationStudentBookmark.findOne({ where: { bookmark_id: bookmarkId, student_profile_id: studentProfileId } });
  if (!bookmark) throw createEducationError("Bookmark not found", 404, "BOOKMARK_NOT_FOUND");

  await bookmark.destroy();
};
