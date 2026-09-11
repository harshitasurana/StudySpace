import express from "express";
import { listUserActivityController, getUserActivityDetailController } from "./user_activity_controller.js";
import { authenticate, authorizeFeature } from "../../../common/middlewares/auth_middleware.js";
import { validateQuery } from "../../../common/middlewares/validate.js";
import { listUserActivityQuerySchema, userActivityDetailQuerySchema } from "./user_activity_validation.js";

// Gated the same way as the rest of the admin console — see
// 20260909f_generalize_student_activity_to_user_activity.sql for the
// Feature row rename/re-parent (was "Student Activity Monitoring" under
// Education Management; existing permission grants carry over untouched
// since they reference feature_id, not the name).
const USER_ACTIVITY_FEATURE = "User Activity Monitoring";

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorizeFeature(USER_ACTIVITY_FEATURE, "can_read"),
  validateQuery(listUserActivityQuerySchema),
  listUserActivityController
);

router.get(
  "/:userId",
  authorizeFeature(USER_ACTIVITY_FEATURE, "can_read"),
  validateQuery(userActivityDetailQuerySchema),
  getUserActivityDetailController
);

export default router;
