import express from "express";
import {
  getBoardsController,
  getClassesController,
  getSubjectsController,
  createBoardController,
  createClassController,
  createSubjectController,
  updateSubjectController,
} from "./academic_controller.js";
import { authenticate, authorizeFeature } from "../../common/middlewares/auth_middleware.js";
import { validateQuery, validateBody } from "../../common/middlewares/validate.js";
import {
  classesQuerySchema,
  subjectsQuerySchema,
  createBoardSchema,
  createClassSchema,
  createSubjectSchema,
  updateSubjectSchema,
} from "./academic_validation.js";

// Same feature the Curriculum Management screen (Education-Admin) already
// gates chapter create/update/delete on — Board/Class/Subject creation is
// part of that same admin workflow (setting up curriculum data), not a
// separate permission surface.
const CURRICULUM_MANAGEMENT_FEATURE = "Curriculum Management";

const router = express.Router();

// Any authenticated user can read academic metadata — it's reference data
// used by the onboarding selectors (BoardPicker/ClassPicker/SubjectSelector),
// not something that needs role-based restriction.
router.use(authenticate);

router.get("/boards", getBoardsController);
router.get("/classes", validateQuery(classesQuerySchema), getClassesController);
router.get("/subjects", validateQuery(subjectsQuerySchema), getSubjectsController);

router.post(
  "/boards",
  authorizeFeature(CURRICULUM_MANAGEMENT_FEATURE, "can_create"),
  validateBody(createBoardSchema),
  createBoardController
);
router.post(
  "/classes",
  authorizeFeature(CURRICULUM_MANAGEMENT_FEATURE, "can_create"),
  validateBody(createClassSchema),
  createClassController
);
router.post(
  "/subjects",
  authorizeFeature(CURRICULUM_MANAGEMENT_FEATURE, "can_create"),
  validateBody(createSubjectSchema),
  createSubjectController
);
router.put(
  "/subjects/:id",
  authorizeFeature(CURRICULUM_MANAGEMENT_FEATURE, "can_update"),
  validateBody(updateSubjectSchema),
  updateSubjectController
);

export default router;
