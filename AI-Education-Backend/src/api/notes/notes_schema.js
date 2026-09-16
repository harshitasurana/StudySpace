import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";

export const EducationStudentNote = sequelize.define(
  "EducationStudentNote",
  {
    note_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    student_profile_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: EducationStudentProfile, key: "student_profile_id" } },
    // Nullable — a note can be general or scoped to a chapter.
    chapter_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: EducationChapter, key: "chapter_id" } },
    title: { type: DataTypes.STRING(255), allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    // Free-text student tags — [] by default, never fabricated/suggested
    // server-side, purely what the student typed in.
    tags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    // NULL = the student wrote this themselves (every note today). Set
    // = a parent did, while acting as this child — same
    // owner-vs-actor split as ai_messages.added_by_user_id.
    added_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "education_student_notes", underscored: true, timestamps: true, createdAt: "created_at", updatedAt: "updated_at" }
);

EducationStudentNote.associate = (models) => {
  EducationStudentNote.belongsTo(models.EducationStudentProfile, { foreignKey: "student_profile_id", as: "studentProfile" });
  EducationStudentNote.belongsTo(models.EducationChapter, { foreignKey: "chapter_id", as: "chapter" });
};

// Global search (Topbar) — see help_center_schema.js's searchConfig
// comment for how this gets picked up automatically. Notes are private,
// so this is owner-scoped (level: "read_own"): a student only ever sees
// their OWN notes in search results. student_profile_id isn't on the JWT
// (see search_controller.js's withStudentProfileId), so ownerValue reads
// it off the enriched user object that controller resolves per-request —
// role keys here must match roles.role_name exactly ("Student", "School
// Student"), not the lowercase convention the frontend uses for routing.
// tags is deliberately excluded from `fields` — it's JSONB, and the
// shared search framework's plain ILIKE matcher can't safely compare a
// JSON column without an explicit cast, so including it throws and
// silently zeroes out every result (see help_center_schema.js's article
// searchConfig comment for the same bug, hit and fixed there first).
EducationStudentNote.searchConfig = {
  key: "notes",
  label: "My Notes",
  category: "workspace",
  permissionFeatures: [],
  fields: ["title", "content"],
  roleAccess: {
    Student: { level: "read_own", ownerField: "student_profile_id", ownerValue: "req.user.student_profile_id" },
    "School Student": { level: "read_own", ownerField: "student_profile_id", ownerValue: "req.user.student_profile_id" },
  },
  display: {
    title: (row) => row.title || "Untitled note",
    subtitle: () => "My Notes",
    description: "content",
  },
  route: () => "/notes/my-notes",
  meta: (row) => ({ note_id: row.note_id, chapter_id: row.chapter_id }),
  order: [["updated_at", "DESC"]],
};

export default { EducationStudentNote };
