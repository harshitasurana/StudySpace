import express from "express";
import {
  getOverviewController,
  getSubjectsController,
  getAchievementsController,
  getGameStatsController,
} from "./progress_controller.js";
import { authenticate } from "../../common/middlewares/auth_middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/overview", getOverviewController);
router.get("/subjects", getSubjectsController);
router.get("/achievements", getAchievementsController);
router.get("/game-stats", getGameStatsController);

export default router;
