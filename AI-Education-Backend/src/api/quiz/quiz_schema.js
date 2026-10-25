import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";

export const QuizAttempt = sequelize.define(
  "QuizAttempt",
  {
    attempt_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    student_profile_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: EducationStudentProfile, key: "student_profile_id" } },
    chapter_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: EducationChapter, key: "chapter_id" } },
    attempt_type: { type: DataTypes.ENUM("quiz", "mock_test", "pre_assessment"), allowNull: false, defaultValue: "quiz" },
    // [{ question, options, correct_answer, explanation }, ...] — generated
    // once by the AI service and frozen here; never regenerated or trusted
    // from the client again. Null while generation_status is "processing"
    // or "failed".
    questions: { type: DataTypes.JSONB, allowNull: true },
    total_questions: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.ENUM("in_progress", "submitted"), allowNull: false, defaultValue: "in_progress" },
    // Generation lifecycle — separate from `status` above, which tracks
    // ANSWERING progress and is meaningless until this is "completed". A
    // row is now created as "processing" BEFORE the AI service is called
    // (see generateQuizService), so it survives the student navigating
    // away mid-generation; RAGProductionApp's Celery worker reports the
    // outcome via POST /api/quiz/attempts/:attemptId/callback.
    generation_status: { type: DataTypes.ENUM("processing", "completed", "failed"), allowNull: false, defaultValue: "completed" },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    // The resolved buildQuizFocus() instruction (and, for a note-to-quiz
    // conversion, the exact grounding text) — persisted so a stuck-row
    // retry can redo the EXACT original generation request. See
    // recoverStuckQuizAttempt.
    generation_focus: { type: DataTypes.TEXT, allowNull: true },
    source_text: { type: DataTypes.TEXT, allowNull: true },
    score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    submitted_at: { type: DataTypes.DATE, allowNull: true },
    // NULL = the student generated/took this themselves (every attempt
    // today). Set = a parent did, while acting as this child — the
    // attempt still belongs to (and counts toward) the child's own
    // student_profile_id either way, same as ai_messages.added_by_user_id.
    added_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "quiz_attempts", underscored: true, timestamps: true, createdAt: "created_at", updatedAt: "updated_at" }
);

export const QuizAnswer = sequelize.define(
  "QuizAnswer",
  {
    answer_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    attempt_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: QuizAttempt, key: "attempt_id" } },
    question_index: { type: DataTypes.INTEGER, allowNull: false },
    selected_answer: { type: DataTypes.STRING(10), allowNull: false },
    is_correct: { type: DataTypes.BOOLEAN, allowNull: false },
  },
  {
    tableName: "quiz_answers",
    underscored: true,
    timestamps: true,
    createdAt: "answered_at",
    updatedAt: false,
    indexes: [{ unique: true, fields: ["attempt_id", "question_index"] }],
  }
);

QuizAttempt.associate = (models) => {
  QuizAttempt.belongsTo(models.EducationStudentProfile, { foreignKey: "student_profile_id", as: "studentProfile" });
  QuizAttempt.belongsTo(models.EducationChapter, { foreignKey: "chapter_id", as: "chapter" });
  QuizAttempt.hasMany(models.QuizAnswer, { foreignKey: "attempt_id", as: "answers" });
};

QuizAnswer.associate = (models) => {
  QuizAnswer.belongsTo(models.QuizAttempt, { foreignKey: "attempt_id", as: "attempt" });
};

export default { QuizAttempt, QuizAnswer };
