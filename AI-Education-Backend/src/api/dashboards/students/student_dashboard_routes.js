import express from "express";
import { getStudentDashboardController } from "./student_dashboard_controller.js";
import { authenticate } from "../../../common/middlewares/auth_middleware.js";

const router = express.Router();

router.use(authenticate);
router.get("/", getStudentDashboardController);

export default router;