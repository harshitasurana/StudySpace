import { listBookmarksService, createBookmarkService, updateBookmarkService, deleteBookmarkService } from "./bookmarks_service.js";

export const listController = async (req, res) => {
  try {
    const result = await listBookmarksService(req.studentScope.studentProfileId, { chapterId: req.query.chapter_id, collection: req.query.collection });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load bookmarks" });
  }
};

export const createController = async (req, res) => {
  try {
    const { chapter_id, source_type, title, content, collection, page_index } = req.body;
    const result = await createBookmarkService(req.studentScope.studentProfileId, {
      chapterId: chapter_id,
      sourceType: source_type,
      title,
      content,
      collection,
      pageIndex: page_index,
      addedByUserId: req.user.acting_as_parent_user_id || null,
    });
    return res.status(201).json({ success: true, message: "Bookmark created successfully", data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to create bookmark" });
  }
};

export const updateController = async (req, res) => {
  try {
    const result = await updateBookmarkService(req.studentScope.studentProfileId, req.params.bookmarkId, { collection: req.body.collection });
    return res.status(200).json({ success: true, message: "Bookmark updated successfully", data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to update bookmark" });
  }
};

export const deleteController = async (req, res) => {
  try {
    await deleteBookmarkService(req.studentScope.studentProfileId, req.params.bookmarkId);
    return res.status(200).json({ success: true, message: "Bookmark deleted successfully" });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to delete bookmark" });
  }
};
