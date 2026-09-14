import express from "express";
import { listController, createController, deleteController } from "./highlights_controller.js";
import { authenticate } from "../../common/middlewares/auth_middleware.js";
import { validateBody, validateQuery, validateParams } from "../../common/middlewares/validate.js";
import { createHighlightSchema, listHighlightsQuerySchema, highlightParamsSchema } from "./highlights_validation.js";

const router = express.Router();

router.use(authenticate);

router.get("/", validateQuery(listHighlightsQuerySchema), listController);
router.post("/", validateBody(createHighlightSchema), createController);
router.delete("/:highlightId", validateParams(highlightParamsSchema), deleteController);

export default router;
