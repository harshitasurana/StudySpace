import express from "express";
import { listController, createController, updateController, deleteController } from "./bookmarks_controller.js";
import { authenticate, requireStudentProfile } from "../../common/middlewares/auth_middleware.js";
import { validateBody, validateQuery, validateParams } from "../../common/middlewares/validate.js";
import {
  createBookmarkSchema,
  updateBookmarkSchema,
  listBookmarksQuerySchema,
  bookmarkParamsSchema,
} from "./bookmarks_validation.js";

const router = express.Router();

router.use(authenticate);
router.use(requireStudentProfile);

router.get("/", validateQuery(listBookmarksQuerySchema), listController);
router.post("/", validateBody(createBookmarkSchema), createController);
router.put("/:bookmarkId", validateParams(bookmarkParamsSchema), validateBody(updateBookmarkSchema), updateController);
router.delete("/:bookmarkId", validateParams(bookmarkParamsSchema), deleteController);

export default router;
