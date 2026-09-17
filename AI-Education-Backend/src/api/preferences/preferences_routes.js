import express from "express";
import { savePreferencesController } from "./preferences_controller.js";
import { authenticate } from "../../common/middlewares/auth_middleware.js";
import { validateBody as validate } from "../../common/middlewares/validate.js";
import { savePreferencesSchema } from "./preferences_validation.js";

const router = express.Router();

router.use(authenticate);
router.post("/", validate(savePreferencesSchema), savePreferencesController);

export default router;
