import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";

export const EducationLearningPreference = sequelize.define(
  "EducationLearningPreference",
  {
    preference_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    student_profile_id: {
      // One preference row per profile — saving preferences again during
      // onboarding (e.g. user goes back a step) updates this row rather
      // than creating a duplicate.
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: EducationStudentProfile,
        key: "student_profile_id",
      },
    },
    preferred_language: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    learning_goal: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    difficulty_level: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    subject_interests: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    learning_style: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    content_preferences: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    allow_parent_tracking: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "education_learning_preferences",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

EducationLearningPreference.associate = (models) => {
  EducationLearningPreference.belongsTo(models.EducationStudentProfile, {
    foreignKey: "student_profile_id",
    as: "studentProfile",
  });
};

export default EducationLearningPreference;
