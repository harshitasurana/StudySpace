import express from "express";
import {
  createStudentProfileController,
  completeStudentProfileController,
  getMyStudentProfileController,
  markGuidedWalkthroughSeenController,
} from "./student_profile_controller.js";
import { authenticate } from "../../common/middlewares/auth_middleware.js";
import { validateBody as validate } from "../../common/middlewares/validate.js";
import { createStudentProfileSchema } from "./student_profile_validation.js";

const router = express.Router();

// Self-service only — every route here reads/writes the CALLING user's own
// profile (req.user.user_id). No admin param-based routes exist yet;
// add those separately (with proper authorize()) if an admin/teacher view
// of other students' profiles is needed later.
router.use(authenticate);

router.get("/", getMyStudentProfileController);
router.post("/", validate(createStudentProfileSchema), createStudentProfileController);
router.post("/complete", completeStudentProfileController);
router.post("/guided-walkthrough-seen", markGuidedWalkthroughSeenController);

export default router;
