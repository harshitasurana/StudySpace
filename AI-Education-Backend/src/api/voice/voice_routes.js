import express from "express";
import multer from "multer";
import { voiceTurnController } from "./voice_controller.js";
import { authenticate } from "../../common/middlewares/auth_middleware.js";
import { validateBody } from "../../common/middlewares/validate.js";
import { voiceTurnSchema } from "./voice_validation.js";

// Push-to-talk utterances only, in memory — same memoryStorage pattern
// as ingestion_routes.js's uploadChapterPdf, sized for a short spoken
// question rather than a textbook PDF.
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
}).single("audio");

const router = express.Router();

router.use(authenticate);

// multer runs before validateBody so chapter_id/conversation_id (sent as
// multipart text fields alongside the audio file) land on req.body the
// same way a JSON body would for every other validated route.
router.post("/turn", uploadAudio, validateBody(voiceTurnSchema), voiceTurnController);

export default router;
