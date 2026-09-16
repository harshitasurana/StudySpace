import express from "express";
import { getOnboardingConfigController } from "./onboarding_controller.js";
import { authenticate } from "../../common/middlewares/auth_middleware.js";
import { validateQuery } from "../../common/middlewares/validate.js";
import { onboardingConfigQuerySchema } from "./onboarding_validation.js";

const router = express.Router();

router.use(authenticate);
router.get("/config", validateQuery(onboardingConfigQuerySchema), getOnboardingConfigController);

export default router;
