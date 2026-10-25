import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import User from "../user/user_schema.js";
import Role from "../roles/role_schema.js";

// Tracks onboarding progress per user so a refresh or a resumed session
// can pick up where the user left off (per the architecture plan's
// "Use backend onboarding_session_id to resume a partially finished flow").
// Sprint 1 manages this internally (created/updated from the onboarding
// config and student-profile endpoints) rather than exposing separate
// session CRUD routes — see onboarding_service.js.
export const EducationOnboardingSession = sequelize.define(
  "EducationOnboardingSession",
  {
    onboarding_session_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "user_id",
      },
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Role,
        key: "role_id",
      },
    },
    persona: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    current_step: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    status: {
      type: DataTypes.ENUM("in_progress", "completed", "abandoned"),
      allowNull: false,
      defaultValue: "in_progress",
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "education_onboarding_sessions",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

EducationOnboardingSession.associate = (models) => {
  EducationOnboardingSession.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
  EducationOnboardingSession.belongsTo(models.Role, { foreignKey: "role_id", as: "role" });
};

export default EducationOnboardingSession;
