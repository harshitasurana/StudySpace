import { Op } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationCalendarEvent, EducationExamDetail, EducationExamChapter } from "./calendar_schema.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";
import { EducationAcademicSubject } from "../academic/academic_schema.js";
import { resolveStudentClassId } from "../curriculum/curriculum_service.js";
import { createEducationError } from "../education_errors.js";
import { daysRemaining } from "../../common/utils/streak_dates.js";

const requireStudentScope = async (userId) => {
  const scope = await resolveStudentClassId(userId);
  if (!scope) throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  return scope;
};

// Never trust a client-supplied chapter_id blindly — same ownership check
// curriculum_service.js's own chapter routes already use (real, active
// chapter that belongs to the caller's own class).
const assertChapterOwned = async (chapterId, classId) => {
  const chapter = await EducationChapter.findOne({ where: { chapter_id: chapterId, is_active: true } });
  if (!chapter) throw createEducationError(`Chapter ${chapterId} not found`, 404, "CHAPTER_NOT_FOUND");
  if (chapter.class_id !== classId) throw createEducationError(`Chapter ${chapterId} does not belong to your class`, 403, "CHAPTER_CLASS_MISMATCH");
};

const assertSubjectExists = async (subjectId) => {
  const subject = await EducationAcademicSubject.findOne({ where: { subject_id: subjectId, is_active: true } });
  if (!subject) throw createEducationError("Invalid subject_id", 400, "INVALID_SUBJECT");
};

const CHAPTER_INCLUDE = { model: EducationChapter, as: "chapter", attributes: ["chapter_id", "name", "chapter_order"] };
const SUBJECT_INCLUDE = { model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] };
const EXAM_DETAIL_INCLUDE = {
  model: EducationExamDetail,
  as: "examDetail",
  include: [{ model: EducationChapter, as: "chapters", attributes: ["chapter_id", "name", "chapter_order"], through: { attributes: [] } }],
};

export const listEventsService = async (userId, { start, end, eventType, subjectId } = {}) => {
  const { studentProfileId } = await requireStudentScope(userId);

  // student_profile_id IS NULL rows are GLOBAL events (currently only
  // seeded national holidays) — visible to every student alongside their
  // own personal events, never owned/editable by any one of them.
  const where = { [Op.or]: [{ student_profile_id: studentProfileId }, { student_profile_id: null }] };
  if (start && end) where.start_datetime = { [Op.between]: [start, end] };
  else if (start) where.start_datetime = { [Op.gte]: start };
  else if (end) where.start_datetime = { [Op.lte]: end };
  if (eventType) where.event_type = eventType;
  if (subjectId) where.subject_id = subjectId;

  return EducationCalendarEvent.findAll({
    where,
    include: [SUBJECT_INCLUDE, CHAPTER_INCLUDE, EXAM_DETAIL_INCLUDE],
    order: [["start_datetime", "ASC"]],
  });
};

export const createEventService = async (userId, payload) => {
  const { studentProfileId, classId } = await requireStudentScope(userId);
  const { event_type, title, description, start_datetime, end_datetime, all_day, subject_id, chapter_id, notes, color } = payload;

  if (subject_id) await assertSubjectExists(subject_id);
  if (chapter_id) await assertChapterOwned(chapter_id, classId);

  const event = await EducationCalendarEvent.create({
    student_profile_id: studentProfileId,
    event_type,
    title,
    description: description || null,
    start_datetime,
    end_datetime,
    all_day: Boolean(all_day),
    subject_id: subject_id || null,
    chapter_id: chapter_id || null,
    notes: notes || null,
    color: color || null,
  });

  return EducationCalendarEvent.findOne({ where: { calendar_event_id: event.calendar_event_id }, include: [SUBJECT_INCLUDE, CHAPTER_INCLUDE] });
};

// Exams create the calendar_event + exam_details + exam_chapters rows
// together in one transaction — a partial write (an event with no exam
// detail, or an exam detail with no chapters) is never a valid state to
// leave behind.
export const createExamEventService = async (userId, payload) => {
  const { studentProfileId, classId } = await requireStudentScope(userId);
  const { title, description, start_datetime, end_datetime, all_day, subject_id, exam_type, total_marks, chapter_ids, notes, color } = payload;

  await assertSubjectExists(subject_id);
  for (const chapterId of chapter_ids) {
    await assertChapterOwned(chapterId, classId);
  }

  return sequelize.transaction(async (t) => {
    const event = await EducationCalendarEvent.create(
      {
        student_profile_id: studentProfileId,
        event_type: "EXAM",
        title,
        description: description || null,
        start_datetime,
        end_datetime,
        all_day: Boolean(all_day),
        subject_id,
        notes: notes || null,
        color: color || null,
      },
      { transaction: t }
    );

    const examDetail = await EducationExamDetail.create(
      { calendar_event_id: event.calendar_event_id, exam_type, total_marks: total_marks ?? null },
      { transaction: t }
    );

    await EducationExamChapter.bulkCreate(
      chapter_ids.map((chapterId) => ({ exam_detail_id: examDetail.exam_detail_id, chapter_id: chapterId })),
      { transaction: t }
    );

    return EducationCalendarEvent.findOne({
      where: { calendar_event_id: event.calendar_event_id },
      include: [SUBJECT_INCLUDE, EXAM_DETAIL_INCLUDE],
      transaction: t,
    });
  });
};

const findOwnedEvent = async (studentProfileId, eventId) => {
  const event = await EducationCalendarEvent.findOne({
    where: { calendar_event_id: eventId, student_profile_id: studentProfileId },
    include: [EXAM_DETAIL_INCLUDE],
  });
  if (!event) throw createEducationError("Calendar event not found", 404, "CALENDAR_EVENT_NOT_FOUND");
  return event;
};

export const updateEventService = async (userId, eventId, payload) => {
  const { studentProfileId, classId } = await requireStudentScope(userId);
  const event = await findOwnedEvent(studentProfileId, eventId);

  const { subject_id, chapter_id, chapter_ids, exam_type, total_marks, ...rest } = payload;

  // Converting a plain event into an exam (or vice versa) would leave an
  // orphaned/missing exam_details row — out of scope for Phase 1. Exams are
  // only ever created via POST /events/exam.
  if (rest.event_type && (rest.event_type === "EXAM") !== (event.event_type === "EXAM")) {
    throw createEducationError("Changing an event to/from type EXAM isn't supported — delete and recreate instead", 400, "EVENT_TYPE_CHANGE_NOT_SUPPORTED");
  }

  if (subject_id) await assertSubjectExists(subject_id);
  if (chapter_id) await assertChapterOwned(chapter_id, classId);
  if (chapter_ids) {
    for (const chapterId of chapter_ids) await assertChapterOwned(chapterId, classId);
  }

  return sequelize.transaction(async (t) => {
    await event.update(
      {
        ...rest,
        ...(subject_id !== undefined && { subject_id }),
        ...(chapter_id !== undefined && { chapter_id }),
      },
      { transaction: t }
    );

    if (event.event_type === "EXAM" && (exam_type !== undefined || total_marks !== undefined || chapter_ids !== undefined)) {
      if (!event.examDetail) throw createEducationError("Exam detail missing for this event", 500, "EXAM_DETAIL_MISSING");

      await event.examDetail.update(
        {
          ...(exam_type !== undefined && { exam_type }),
          ...(total_marks !== undefined && { total_marks }),
        },
        { transaction: t }
      );

      if (chapter_ids !== undefined) {
        await EducationExamChapter.destroy({ where: { exam_detail_id: event.examDetail.exam_detail_id }, transaction: t });
        await EducationExamChapter.bulkCreate(
          chapter_ids.map((chapterId) => ({ exam_detail_id: event.examDetail.exam_detail_id, chapter_id: chapterId })),
          { transaction: t }
        );
      }
    }

    return EducationCalendarEvent.findOne({
      where: { calendar_event_id: eventId },
      include: [SUBJECT_INCLUDE, CHAPTER_INCLUDE, EXAM_DETAIL_INCLUDE],
      transaction: t,
    });
  });
};

export const deleteEventService = async (userId, eventId) => {
  const { studentProfileId } = await requireStudentScope(userId);
  const event = await findOwnedEvent(studentProfileId, eventId);
  // exam_details/exam_chapters cascade via their own FK ON DELETE CASCADE.
  await event.destroy();
};

export const getUpcomingEventsService = async (userId, { limit } = {}) => {
  const { studentProfileId } = await requireStudentScope(userId);
  const events = await EducationCalendarEvent.findAll({
    where: { student_profile_id: studentProfileId, start_datetime: { [Op.gte]: new Date() }, status: "scheduled" },
    include: [SUBJECT_INCLUDE, CHAPTER_INCLUDE],
    order: [["start_datetime", "ASC"]],
    limit: limit || 10,
  });
  return events;
};

export const getUpcomingExamsService = async (userId, { limit } = {}) => {
  const { studentProfileId } = await requireStudentScope(userId);
  const exams = await EducationCalendarEvent.findAll({
    where: { student_profile_id: studentProfileId, event_type: "EXAM", start_datetime: { [Op.gte]: new Date() }, status: "scheduled" },
    include: [SUBJECT_INCLUDE, EXAM_DETAIL_INCLUDE],
    order: [["start_datetime", "ASC"]],
    limit: limit || 5,
  });

  return exams.map((exam) => ({
    ...exam.toJSON(),
    days_remaining: daysRemaining(exam.start_datetime),
  }));
};
