import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";

// Per-student "I've generated/received this mind map" record — direct
// mirror of flashcards_schema.js's EducationFlashcardSetView, just keyed
// by generation_group_id (the 5 variant rows one generation call produces,
// see mindmap_schema.js) instead of a single row id. Powers each
// student's own "My Mind Maps" history in listMindMapsService, bumped
// (upserted) every time a student's request resolves to a pool group,
// whether they triggered the generation or reused an existing one.
export const EducationMindMapView = sequelize.define(
  "EducationMindMapView",
  {
    student_profile_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: EducationStudentProfile, key: "student_profile_id" },
    },
    generation_group_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    viewed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "education_mind_map_views",
    underscored: true,
    timestamps: false,
  }
);

EducationMindMapView.associate = (models) => {
  EducationMindMapView.belongsTo(models.EducationStudentProfile, { foreignKey: "student_profile_id", as: "studentProfile" });
};

export default EducationMindMapView;
