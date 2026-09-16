import { listNotesService, createNoteService, updateNoteService, deleteNoteService } from "./notes_service.js";

export const listController = async (req, res) => {
  try {
    const result = await listNotesService(req.user.user_id, { chapterId: req.query.chapter_id });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load notes" });
  }
};

export const createController = async (req, res) => {
  try {
    const { chapter_id, title, content, tags } = req.body;
    const result = await createNoteService(req.user.user_id, {
      chapterId: chapter_id,
      title,
      content,
      tags,
      addedByUserId: req.user.acting_as_parent_user_id || null,
    });
    return res.status(201).json({ success: true, message: "Note created successfully", data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to create note" });
  }
};

export const updateController = async (req, res) => {
  try {
    const result = await updateNoteService(req.user.user_id, req.params.noteId, req.body);
    return res.status(200).json({ success: true, message: "Note updated successfully", data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to update note" });
  }
};

export const deleteController = async (req, res) => {
  try {
    await deleteNoteService(req.user.user_id, req.params.noteId);
    return res.status(200).json({ success: true, message: "Note deleted successfully" });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to delete note" });
  }
};
