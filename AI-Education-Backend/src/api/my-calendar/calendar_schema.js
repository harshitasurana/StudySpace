import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationAcademicSubject } from "../academic/academic_schema.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";

// A self-student's personal calendar — owned entirely by the student, no
// school-calendar import, no shared/multi-user editing. Deliberately named
// "education_calendar_events" (not "calendar_events") — this app already
// has an unrelated, pre-existing "calendar_events" table/route
// (src/api/calendar/) from the generic CRM/healthcare template this
// backend was forked from; reusing that name would collide.
export const EducationCalendarEvent = sequelize.define(
  "EducationCalendarEvent",
  {
    calendar_event_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    // Nullable so a single row can represent a GLOBAL event (currently just
    // national holidays) visible to every student, instead of needing one
    // duplicated row per student — see listEventsService, which ORs in
    // student_profile_id IS NULL alongside the caller's own rows.
    student_profile_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: EducationStudentProfile, key: "student_profile_id" } },
    event_type: {
      type: DataTypes.ENUM("EXAM", "ASSIGNMENT", "STUDY", "REVISION", "ACADEMIC", "REMINDER", "HOLIDAY"),
      allowNull: false,
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    start_datetime: { type: DataTypes.DATE, allowNull: false },
    end_datetime: { type: DataTypes.DATE, allowNull: false },
    all_day: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    subject_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: EducationAcademicSubject, key: "subject_id" } },
    // Single-chapter association for non-exam events; exams cover
    // potentially several chapters via EducationExamChapter instead.
    chapter_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: EducationChapter, key: "chapter_id" } },
    status: {
      type: DataTypes.ENUM("scheduled", "completed", "cancelled"),
      allowNull: false,
      defaultValue: "scheduled",
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
    // Nullable override — the real default is derived client-side from
    // event_type (this app's own existing palette), not persisted per-row.
    color: { type: DataTypes.STRING(20), allowNull: true },
  },
  {
    tableName: "education_calendar_events",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["student_profile_id", "start_datetime"] },
      { fields: ["event_type"] },
    ],
  }
);

export const EducationExamDetail = sequelize.define(
  "EducationExamDetail",
  {
    exam_detail_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    calendar_event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: EducationCalendarEvent, key: "calendar_event_id" },
    },
    exam_type: {
      type: DataTypes.ENUM("UNIT_TEST", "MID_TERM", "FINAL", "MOCK_TEST", "OTHER"),
      allowNull: false,
    },
    total_marks: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "education_exam_details",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// Many-to-many "Mathematics Mid-Term covers Chapters 1, 2 and 3" — no
// duplicated chapter names, always joined back to the real
// education_chapters row. No own timestamps/PK — composite PK on the two
// FKs, matching the plan's exact design.
export const EducationExamChapter = sequelize.define(
  "EducationExamChapter",
  {
    exam_detail_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: EducationExamDetail, key: "exam_detail_id" },
    },
    chapter_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: EducationChapter, key: "chapter_id" },
    },
  },
  {
    tableName: "education_exam_chapters",
    underscored: true,
    timestamps: false,
  }
);

EducationCalendarEvent.associate = (models) => {
  EducationCalendarEvent.belongsTo(models.EducationStudentProfile, { foreignKey: "student_profile_id", as: "studentProfile" });
  EducationCalendarEvent.belongsTo(models.EducationAcademicSubject, { foreignKey: "subject_id", as: "subject" });
  EducationCalendarEvent.belongsTo(models.EducationChapter, { foreignKey: "chapter_id", as: "chapter" });
  EducationCalendarEvent.hasOne(models.EducationExamDetail, { foreignKey: "calendar_event_id", as: "examDetail" });
};

EducationExamDetail.associate = (models) => {
  EducationExamDetail.belongsTo(models.EducationCalendarEvent, { foreignKey: "calendar_event_id", as: "calendarEvent" });
  EducationExamDetail.belongsToMany(models.EducationChapter, {
    through: models.EducationExamChapter,
    foreignKey: "exam_detail_id",
    otherKey: "chapter_id",
    as: "chapters",
  });
};

export default { EducationCalendarEvent, EducationExamDetail, EducationExamChapter };
