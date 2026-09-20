import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { SamplePaper, SamplePaperQuestion } from "./sample_paper_schema.js";

// Stage 1 (student paper-taking flow) — the student writes every answer on
// paper (organized by question number) and uploads ONE consolidated PDF
// per attempt (answer_pdf_key below), not per-question typed text or
// per-question photos. Grading reuses the Stage 0 admin extraction
// pattern (core/sample_paper_extraction.py): each PDF page is read by the
// local vision model, matched to the paper's real questions by question
// number, then graded against the real rubric/model_answer already in
// Postgres (core/sample_paper_grading.py). See the migration's header
// comment for grading_internal_notes / needs_self_review rationale.
//
// sample_paper_responses is therefore written entirely by the grading
// callback (sample_paper_grading_service.js), never by the student
// directly — one row per question once that question's transcribed
// answer has been matched and graded.

export const SamplePaperAttempt = sequelize.define(
  "SamplePaperAttempt",
  {
    attempt_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    student_profile_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: EducationStudentProfile, key: "student_profile_id" },
    },
    sample_paper_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: SamplePaper, key: "sample_paper_id" },
    },
    status: {
      type: DataTypes.ENUM("in_progress", "submitted", "grading", "graded", "failed"),
      allowNull: false,
      defaultValue: "in_progress",
    },
    total_marks: { type: DataTypes.INTEGER, allowNull: false },
    score: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    // Set once the student uploads their consolidated answer PDF — required
    // before submitPaperService will allow the attempt to be submitted.
    answer_pdf_key: { type: DataTypes.STRING(500), allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    submitted_at: { type: DataTypes.DATE, allowNull: true },
    graded_at: { type: DataTypes.DATE, allowNull: true },
    grading_error: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: "sample_paper_attempts", underscored: true, timestamps: false }
);

export const SamplePaperResponse = sequelize.define(
  "SamplePaperResponse",
  {
    response_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    attempt_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: SamplePaperAttempt, key: "attempt_id" },
    },
    question_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: SamplePaperQuestion, key: "question_id" },
    },
    // The vision model's transcription of the student's handwritten answer
    // for this question, matched by question number from the answer PDF.
    // Null means no matching content was found anywhere in the PDF (not
    // attempted), which still grades to marks_awarded: 0 rather than being
    // silently skipped.
    transcribed_answer: { type: DataTypes.TEXT, allowNull: true },
    max_marks: { type: DataTypes.INTEGER, allowNull: false },
    marks_awarded: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    rubric_breakdown: { type: DataTypes.JSONB, allowNull: true },
    feedback: { type: DataTypes.TEXT, allowNull: true },
    // Server-side only — never serialized to any student-facing route.
    grading_internal_notes: { type: DataTypes.TEXT, allowNull: true },
    grading_confidence: { type: DataTypes.ENUM("high", "medium", "low"), allowNull: true },
    needs_self_review: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    graded_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "sample_paper_responses",
    underscored: true,
    timestamps: false,
    indexes: [{ unique: true, fields: ["attempt_id", "question_id"] }],
  }
);

export const SamplePaperGradingLog = sequelize.define(
  "SamplePaperGradingLog",
  {
    log_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    attempt_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: SamplePaperAttempt, key: "attempt_id" },
    },
    status: { type: DataTypes.ENUM("completed", "failed"), allowNull: false },
    questions_graded: { type: DataTypes.INTEGER, allowNull: true },
    raw_output: { type: DataTypes.TEXT, allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: "sample_paper_grading_logs", underscored: true, timestamps: false }
);

SamplePaperAttempt.associate = (models) => {
  SamplePaperAttempt.belongsTo(models.EducationStudentProfile, { foreignKey: "student_profile_id", as: "studentProfile" });
  SamplePaperAttempt.belongsTo(models.SamplePaper, { foreignKey: "sample_paper_id", as: "samplePaper" });
  SamplePaperAttempt.hasMany(models.SamplePaperResponse, { foreignKey: "attempt_id", as: "responses" });
  SamplePaperAttempt.hasMany(models.SamplePaperGradingLog, { foreignKey: "attempt_id", as: "gradingLogs" });
};

SamplePaperResponse.associate = (models) => {
  SamplePaperResponse.belongsTo(models.SamplePaperAttempt, { foreignKey: "attempt_id", as: "attempt" });
  SamplePaperResponse.belongsTo(models.SamplePaperQuestion, { foreignKey: "question_id", as: "question" });
};

SamplePaperGradingLog.associate = (models) => {
  SamplePaperGradingLog.belongsTo(models.SamplePaperAttempt, { foreignKey: "attempt_id", as: "attempt" });
};

export default { SamplePaperAttempt, SamplePaperResponse, SamplePaperGradingLog };
