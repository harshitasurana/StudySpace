import express from "express";
import {
  getChaptersController,
  createChapterController,
  updateChapterController,
  deleteChapterController,
  getProgressController,
  updateProgressController,
  getChapterMetaController,
  streamChapterPdfController,
  streamNcertSolutionsPdfController,
  streamNcertNotesPdfController,
  getNcertSolutionsIndexController,
} from "./curriculum_controller.js";
import { authenticate, authorizeFeature, requireChapterUnlocked } from "../../common/middlewares/auth_middleware.js";
import { validateQuery, validateBody } from "../../common/middlewares/validate.js";
import {
  chaptersQuerySchema,
  createChapterSchema,
  updateChapterSchema,
  updateProgressSchema,
} from "./curriculum_validation.js";

// Gated by the "Curriculum Management" feature (Admin Features screen),
// keyed by feature name rather than a hardcoded feature_id — authorizeFeature
// looks the feature up by name at request time, so this works as soon as
// that feature row exists, with no code change needed once it's created.
const CURRICULUM_MANAGEMENT_FEATURE = "Curriculum Management";

const router = express.Router();

router.use(authenticate);

router.get("/chapters", validateQuery(chaptersQuerySchema), getChaptersController);
router.post(
  "/chapters",
  authorizeFeature(CURRICULUM_MANAGEMENT_FEATURE, "can_create"),
  validateBody(createChapterSchema),
  createChapterController
);
router.put(
  "/chapters/:id",
  authorizeFeature(CURRICULUM_MANAGEMENT_FEATURE, "can_update"),
  validateBody(updateChapterSchema),
  updateChapterController
);
router.delete(
  "/chapters/:id",
  authorizeFeature(CURRICULUM_MANAGEMENT_FEATURE, "can_delete"),
  deleteChapterController
);

router.get("/progress/:studentProfileId", getProgressController);
router.put("/progress/:studentProfileId", validateBody(updateProgressSchema), updateProgressController);

router.get("/chapters/:chapterId/meta", getChapterMetaController);
router.get("/chapters/:chapterId/pdf", requireChapterUnlocked, streamChapterPdfController);
router.get("/chapters/:chapterId/ncert-solutions-pdf", requireChapterUnlocked, streamNcertSolutionsPdfController);
router.get("/chapters/:chapterId/ncert-notes-pdf", requireChapterUnlocked, streamNcertNotesPdfController);
router.get("/chapters/:chapterId/ncert-solutions-index", getNcertSolutionsIndexController);

export default router;
