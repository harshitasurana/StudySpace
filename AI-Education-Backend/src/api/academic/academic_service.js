import {
  EducationAcademicBoard,
  EducationAcademicClass,
  EducationAcademicSubject,
} from "./academic_schema.js";
import { EducationStudentProfile, EducationStudentSubject } from "../student-profile/student_profile_schema.js";
import { createEducationError } from "../education_errors.js";

// Read-only metadata lookups used by the academic selector steps in
// onboarding (BoardPicker / ClassPicker / SubjectSelector). All three are
// intentionally simple — no pagination/search — since these are small,
// slow-changing reference lists, not admin-managed CRUD resources yet.

export const getBoardsService = async () => {
  return EducationAcademicBoard.findAll({
    where: { is_active: true },
    attributes: ["board_id", "name", "code", "description"],
    order: [["name", "ASC"]],
  });
};

export const getClassesService = async (boardId = null) => {
  const where = { is_active: true };
  if (boardId) {
    // A class row with board_id = null is board-agnostic (shared across
    // boards), so it should still show up when filtering by a specific
    // board — hence the OR rather than a plain equality filter.
    const { Op } = await import("sequelize");
    where[Op.or] = [{ board_id: boardId }, { board_id: null }];
  }

  return EducationAcademicClass.findAll({
    where,
    attributes: ["class_id", "name", "grade_level", "board_id"],
    order: [
      ["grade_level", "ASC"],
      ["name", "ASC"],
    ],
  });
};

export const getSubjectsService = async (boardId = null, classId = null, includeInactive = false) => {
  const { Op } = await import("sequelize");
  const where = includeInactive ? {} : { is_active: true };
  const scoped = [];

  if (boardId) scoped.push({ [Op.or]: [{ board_id: boardId }, { board_id: null }] });
  if (classId) scoped.push({ [Op.or]: [{ class_id: classId }, { class_id: null }] });
  if (scoped.length) where[Op.and] = scoped;

  return EducationAcademicSubject.findAll({
    where,
    attributes: ["subject_id", "name", "code", "board_id", "class_id", "description", "is_active"],
    order: [["name", "ASC"]],
  });
};

// Create-only (no update/delete yet) — added for the admin content-ingestion
// UI (Education-Admin's Curriculum Management screen), which needs to add a
// new Board/Class/Subject inline rather than being blocked on someone
// seeding one by hand first.

export const createBoardService = async ({ name, code, description }) => {
  const existing = await EducationAcademicBoard.findOne({ where: { name } });
  if (existing) throw createEducationError("A board with this name already exists", 409, "BOARD_ALREADY_EXISTS");

  return EducationAcademicBoard.create({ name, code: code || null, description: description || null });
};

export const createClassService = async ({ name, grade_level, board_id }) => {
  if (board_id) {
    const board = await EducationAcademicBoard.findOne({ where: { board_id, is_active: true } });
    if (!board) throw createEducationError("Invalid board_id", 400, "INVALID_BOARD");
  }

  const existing = await EducationAcademicClass.findOne({ where: { name, board_id: board_id || null } });
  if (existing) throw createEducationError("A class with this name already exists for this board", 409, "CLASS_ALREADY_EXISTS");

  return EducationAcademicClass.create({ name, grade_level: grade_level ?? null, board_id: board_id || null });
};

// Onboarding's subject selection (education_student_subjects) is a
// one-time snapshot, not a live view of the catalog — a student who
// onboarded before a subject existed has no way to pick it up
// afterward, short of an admin editing their row by hand. Called right
// after a new EducationAcademicSubject is created so every EXISTING
// student whose board/class this subject applies to (same board_id/
// class_id-null-means-any scoping getSubjectsService already uses)
// gets it added automatically — matching what they'd have selected had
// the subject existed at their onboarding time. ignoreDuplicates so this
// is safe to call more than once for the same subject (e.g. also used
// for a one-off backfill of a subject that predates this hook).
export const backfillSubjectForExistingStudents = async (subject) => {
  // subject.board_id/class_id null means "applies to every board/class"
  // (same convention getSubjectsService reads), so only students with a
  // completed board_id/class_id are candidates here — a profile with
  // neither set yet hasn't finished onboarding, and will pick up every
  // currently-available subject (English included) through the wizard's
  // own live getSubjects() call once it does.
  const where = {};
  if (subject.board_id) where.board_id = subject.board_id;
  if (subject.class_id) where.class_id = subject.class_id;

  const matchingProfiles = await EducationStudentProfile.findAll({
    where,
    attributes: ["student_profile_id"],
  });
  if (!matchingProfiles.length) return { addedCount: 0 };

  const rows = matchingProfiles.map((p) => ({
    student_profile_id: p.student_profile_id,
    subject_id: subject.subject_id,
  }));

  const created = await EducationStudentSubject.bulkCreate(rows, {
    ignoreDuplicates: true,
    returning: true,
  });

  return { addedCount: created.length };
};

export const createSubjectService = async ({ name, code, board_id, class_id, description }) => {
  if (board_id) {
    const board = await EducationAcademicBoard.findOne({ where: { board_id, is_active: true } });
    if (!board) throw createEducationError("Invalid board_id", 400, "INVALID_BOARD");
  }
  if (class_id) {
    const klass = await EducationAcademicClass.findOne({ where: { class_id, is_active: true } });
    if (!klass) throw createEducationError("Invalid class_id", 400, "INVALID_CLASS");
  }

  const existing = await EducationAcademicSubject.findOne({
    where: { name, board_id: board_id || null, class_id: class_id || null },
  });
  if (existing) throw createEducationError("A subject with this name already exists for this board/class", 409, "SUBJECT_ALREADY_EXISTS");

  const subject = await EducationAcademicSubject.create({
    name,
    code: code || null,
    board_id: board_id || null,
    class_id: class_id || null,
    description: description || null,
  });

  await backfillSubjectForExistingStudents(subject);

  return subject;
};

// Active/inactive toggle only (see updateSubjectSchema) — deactivating a
// subject just hides it from student-facing getSubjectsService calls
// (onboarding's SubjectSelector, the practice/chapter pickers, etc.);
// it does not touch any existing student's already-selected
// education_student_subjects rows or their chapters/progress, so
// re-activating later restores full visibility with nothing lost.
export const updateSubjectService = async (subjectId, { is_active }) => {
  const subject = await EducationAcademicSubject.findByPk(subjectId);
  if (!subject) throw createEducationError("Subject not found", 404, "SUBJECT_NOT_FOUND");

  subject.is_active = is_active;
  await subject.save();

  return subject;
};
