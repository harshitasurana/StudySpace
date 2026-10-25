import {
  listEventsService,
  createEventService,
  createExamEventService,
  updateEventService,
  deleteEventService,
  getUpcomingEventsService,
  getUpcomingExamsService,
} from "./calendar_service.js";

export const listEventsController = async (req, res) => {
  try {
    const { start, end, event_type, subject_id } = req.query;
    const result = await listEventsService(req.user.user_id, { start, end, eventType: event_type, subjectId: subject_id });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load calendar events" });
  }
};

export const createEventController = async (req, res) => {
  try {
    const result = await createEventService(req.user.user_id, req.body);
    return res.status(201).json({ success: true, message: "Event added to your calendar.", data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to create event" });
  }
};

export const createExamEventController = async (req, res) => {
  try {
    const result = await createExamEventService(req.user.user_id, req.body);
    return res.status(201).json({ success: true, message: "Exam added to your calendar.", data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to create exam" });
  }
};

export const updateEventController = async (req, res) => {
  try {
    const result = await updateEventService(req.user.user_id, req.params.id, req.body);
    return res.status(200).json({ success: true, message: "Event updated successfully", data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to update event" });
  }
};

export const deleteEventController = async (req, res) => {
  try {
    await deleteEventService(req.user.user_id, req.params.id);
    return res.status(200).json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to delete event" });
  }
};

export const upcomingEventsController = async (req, res) => {
  try {
    const result = await getUpcomingEventsService(req.user.user_id, { limit: req.query.limit ? Number(req.query.limit) : undefined });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load upcoming events" });
  }
};

export const upcomingExamsController = async (req, res) => {
  try {
    const result = await getUpcomingExamsService(req.user.user_id, { limit: req.query.limit ? Number(req.query.limit) : undefined });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load upcoming exams" });
  }
};
