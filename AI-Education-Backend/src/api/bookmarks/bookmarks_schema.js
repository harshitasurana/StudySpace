import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";

// A bookmark is a self-contained snapshot (title/content copied at
// creation time), not a live reference into ai_messages or
// quiz_attempts.questions — so it stays valid even if the source
// conversation is not persisted long-term or a quiz is regenerated.
export const EducationStudentBookmark = sequelize.define(
  "EducationStudentBookmark",
  {
    bookmark_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    student_profile_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: EducationStudentProfile, key: "student_profile_id" } },
    chapter_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: EducationChapter, key: "chapter_id" } },
    source_type: {
      type: DataTypes.ENUM("chapter", "tutor_message", "quiz_question", "diagram", "flashcard", "concept", "test"),
      allowNull: false,
    },
    title: { type: DataTypes.STRING(255), allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    // Optional organizational label the student sets — one of the fixed
    // values below, or null/uncategorized. Never inferred/guessed
    // server-side.
    collection: { type: DataTypes.STRING(20), allowNull: true },
    // Only meaningful for source_type: "chapter" bookmarks created from
    // the reader's own "bookmark this page" button — every other
    // source_type has no page, hence nullable.
    page_index: { type: DataTypes.INTEGER, allowNull: true },
    // NULL = the student bookmarked this themselves (every bookmark
    // today). Set = a parent did, while acting as this child — same
    // owner-vs-actor split as ai_messages.added_by_user_id.
    added_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "education_student_bookmarks", underscored: true, timestamps: true, createdAt: "created_at", updatedAt: false }
);

EducationStudentBookmark.associate = (models) => {
  EducationStudentBookmark.belongsTo(models.EducationStudentProfile, { foreignKey: "student_profile_id", as: "studentProfile" });
  EducationStudentBookmark.belongsTo(models.EducationChapter, { foreignKey: "chapter_id", as: "chapter" });
};

// Global search (Topbar) — owner-scoped like Notes (see notes_schema.js's
// searchConfig comment for the full rationale: student_profile_id comes
// from search_controller.js's per-request lookup, role keys must match
// roles.role_name exactly).
EducationStudentBookmark.searchConfig = {
  key: "bookmarks",
  label: "Bookmarks",
  category: "workspace",
  permissionFeatures: [],
  fields: ["title", "content", "source_type", "collection"],
  roleAccess: {
    Student: { level: "read_own", ownerField: "student_profile_id", ownerValue: "req.user.student_profile_id" },
    "School Student": { level: "read_own", ownerField: "student_profile_id", ownerValue: "req.user.student_profile_id" },
  },
  display: {
    title: (row) => row.title || "Untitled bookmark",
    subtitle: (row) => row.source_type,
    description: "content",
  },
  route: () => "/bookmarks",
  meta: (row) => ({ bookmark_id: row.bookmark_id, chapter_id: row.chapter_id }),
  order: [["created_at", "DESC"]],
};

export default { EducationStudentBookmark };
