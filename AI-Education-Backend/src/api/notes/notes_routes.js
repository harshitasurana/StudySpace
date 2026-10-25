import express from "express";
import { listController, createController, updateController, deleteController } from "./notes_controller.js";
import { authenticate } from "../../common/middlewares/auth_middleware.js";
import { validateBody, validateQuery, validateParams } from "../../common/middlewares/validate.js";
import { createNoteSchema, updateNoteSchema, listNotesQuerySchema, noteParamsSchema } from "./notes_validation.js";

const router = express.Router();

router.use(authenticate);

router.get("/", validateQuery(listNotesQuerySchema), listController);
router.post("/", validateBody(createNoteSchema), createController);
router.put("/:noteId", validateParams(noteParamsSchema), validateBody(updateNoteSchema), updateController);
router.delete("/:noteId", validateParams(noteParamsSchema), deleteController);

export default router;
