import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";

// A self-contained snapshot (the highlighted text copied at creation
// time), same reasoning as EducationStudentBookmark — not a live
// position/offset into the chapter's markdown, since that content can be
// regenerated (education_chapter_content). page_index anchors it to the
// specific reader page it was made on.
export const EducationChapterHighlight = sequelize.define(
  "EducationChapterHighlight",
  {
    highlight_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    student_profile_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: EducationStudentProfile, key: "student_profile_id" } },
    chapter_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: EducationChapter, key: "chapter_id" } },
    page_index: { type: DataTypes.INTEGER, allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
    color: { type: DataTypes.ENUM("yellow", "green", "blue", "pink", "orange"), allowNull: false },
  },
  { tableName: "education_chapter_highlights", underscored: true, timestamps: true, createdAt: "created_at", updatedAt: false }
);

EducationChapterHighlight.associate = (models) => {
  EducationChapterHighlight.belongsTo(models.EducationStudentProfile, { foreignKey: "student_profile_id", as: "studentProfile" });
  EducationChapterHighlight.belongsTo(models.EducationChapter, { foreignKey: "chapter_id", as: "chapter" });
};

export default { EducationChapterHighlight };
