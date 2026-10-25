import express from "express";
import { getStudyPlanController } from "./study_plan_controller.js";
import { authenticate } from "../../common/middlewares/auth_middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getStudyPlanController);

export default router;
