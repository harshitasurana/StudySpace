import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";

// Node owns this table — RAGProductionApp does the actual generation
// (via its Celery worker) and never persists a flashcard set itself; it
// reports the outcome back here via
// POST /api/flashcards/sets/:setId/callback, matching this codebase's
// established "Node owns identity/persistence, FastAPI is stateless
// per-request" convention (mind maps, slide decks, quiz_attempts).
//
// student_profile_id is nullable and means two different things
// depending on which it is — see the migration's own comment:
// NULL = a shared pool member for this chapter+board+standard+
// num_cards (a chapter's pool can hold MANY of these — see
// ensureSharedFlashcardSet in flashcards_service.js); NOT NULL = a
// personal, note-grounded generation (source_text also set) that's
// never shared and never enters the pool.
export const EducationFlashcardSet = sequelize.define(
  "EducationFlashcardSet",
  {
    set_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    chapter_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: EducationChapter, key: "chapter_id" } },
    board: { type: DataTypes.STRING(100), allowNull: false },
    standard: { type: DataTypes.STRING(100), allowNull: false },
    num_cards: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 8 },
    student_profile_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: EducationStudentProfile, key: "student_profile_id" } },
    source_text: { type: DataTypes.TEXT, allowNull: true },
    // [{ front, back }, ...] — null while generation_status is
    // "processing" or "failed".
    cards: { type: DataTypes.JSONB, allowNull: true },
    generation_status: { type: DataTypes.ENUM("processing", "completed", "failed"), allowNull: false, defaultValue: "processing" },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    // Only meaningful alongside a non-null student_profile_id (a
    // personal generation) — NULL there means the student generated it
    // themselves; set means a parent did, acting as this child. Shared
    // pool rows (student_profile_id NULL) have no individual owner to
    // begin with, so this stays NULL for those regardless of who
    // happened to trigger the shared generation.
    added_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "education_flashcard_sets",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// No unique index on (chapter_id, board, standard, num_cards) — that's
// deliberate, not an oversight. Multiple shared pool members are
// expected to coexist for the same scope; see the migration's own
// comment and ensureSharedFlashcardSet.
EducationFlashcardSet.associate = (models) => {
  EducationFlashcardSet.belongsTo(models.EducationStudentProfile, { foreignKey: "student_profile_id", as: "studentProfile" });
  EducationFlashcardSet.belongsTo(models.EducationChapter, { foreignKey: "chapter_id", as: "chapter" });
};

// Per-student "I've generated/received this chapter's flashcards"
// record — a shared EducationFlashcardSet row (student_profile_id NULL)
// has no student of its own to list it under, so this is what powers
// each student's own "Past Sets" history in listFlashcardSetsService,
// bumped (upserted) every time a student's request resolves to a shared
// set, whether they triggered the generation or hit an existing cache.
export const EducationFlashcardSetView = sequelize.define(
  "EducationFlashcardSetView",
  {
    student_profile_id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, references: { model: EducationStudentProfile, key: "student_profile_id" } },
    set_id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, references: { model: EducationFlashcardSet, key: "set_id" } },
    viewed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "education_flashcard_set_views",
    underscored: true,
    timestamps: false,
  }
);

EducationFlashcardSetView.associate = (models) => {
  EducationFlashcardSetView.belongsTo(models.EducationStudentProfile, { foreignKey: "student_profile_id", as: "studentProfile" });
  EducationFlashcardSetView.belongsTo(models.EducationFlashcardSet, { foreignKey: "set_id", as: "set" });
};

export default EducationFlashcardSet;
