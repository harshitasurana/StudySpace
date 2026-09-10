import {
  getBoardsService,
  getClassesService,
  getSubjectsService,
  createBoardService,
  createClassService,
  createSubjectService,
  updateSubjectService,
} from "./academic_service.js";

export const getBoardsController = async (req, res) => {
  try {
    const boards = await getBoardsService();
    return res.status(200).json({ success: true, data: boards });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch boards" });
  }
};

export const getClassesController = async (req, res) => {
  try {
    const boardId = req.query?.board_id ? Number(req.query.board_id) : null;
    const classes = await getClassesService(boardId);
    return res.status(200).json({ success: true, data: classes });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch classes" });
  }
};

export const getSubjectsController = async (req, res) => {
  try {
    const boardId = req.query?.board_id ? Number(req.query.board_id) : null;
    const classId = req.query?.class_id ? Number(req.query.class_id) : null;
    const subjects = await getSubjectsService(boardId, classId, req.query?.include_inactive === true);
    return res.status(200).json({ success: true, data: subjects });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch subjects" });
  }
};

export const createBoardController = async (req, res) => {
  try {
    const board = await createBoardService(req.body);
    return res.status(201).json({ success: true, message: "Board created successfully", data: board });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to create board" });
  }
};

export const createClassController = async (req, res) => {
  try {
    const klass = await createClassService(req.body);
    return res.status(201).json({ success: true, message: "Class created successfully", data: klass });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to create class" });
  }
};

export const createSubjectController = async (req, res) => {
  try {
    const subject = await createSubjectService(req.body);
    return res.status(201).json({ success: true, message: "Subject created successfully", data: subject });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to create subject" });
  }
};

export const updateSubjectController = async (req, res) => {
  try {
    const subject = await updateSubjectService(Number(req.params.id), req.body);
    return res.status(200).json({ success: true, message: "Subject updated successfully", data: subject });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to update subject" });
  }
};
