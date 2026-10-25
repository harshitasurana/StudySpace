import express from "express";
import {
  listEventsController,
  createEventController,
  createExamEventController,
  updateEventController,
  deleteEventController,
  upcomingEventsController,
  upcomingExamsController,
} from "./calendar_controller.js";
import { authenticate } from "../../common/middlewares/auth_middleware.js";
import { validateBody, validateQuery, validateParams } from "../../common/middlewares/validate.js";
import {
  listEventsQuerySchema,
  createEventSchema,
  createExamSchema,
  updateEventSchema,
  eventParamsSchema,
  upcomingQuerySchema,
} from "./calendar_validation.js";

// Mounted at /api/my-calendar (not /api/calendar — see calendar_schema.js's
// own comment for why: an unrelated, pre-existing generic CRM calendar
// module already owns that prefix).
const router = express.Router();

router.use(authenticate);

// Order matters — /upcoming and /exams/upcoming must be registered before
// the generic /events/:id-shaped routes below, and /events/exam before
// /events/:id, so Express doesn't try to parse "exam"/"upcoming" as an id.
router.get("/upcoming", validateQuery(upcomingQuerySchema), upcomingEventsController);
router.get("/exams/upcoming", validateQuery(upcomingQuerySchema), upcomingExamsController);

router.get("/events", validateQuery(listEventsQuerySchema), listEventsController);
router.post("/events", validateBody(createEventSchema), createEventController);
router.post("/events/exam", validateBody(createExamSchema), createExamEventController);
router.patch("/events/:id", validateParams(eventParamsSchema), validateBody(updateEventSchema), updateEventController);
router.delete("/events/:id", validateParams(eventParamsSchema), deleteEventController);

export default router;
