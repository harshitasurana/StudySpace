import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";

// The persisted counterpart to getAchievementsService's live-recomputed
// achieved/not-achieved state (progress_service.js) — one row per
// achievement a student has EVER earned, written exactly once (see
// checkAchievementsAndNotify). Without this there was no way to tell
// "already knew about this" from "just crossed the line just now", so a
// one-time notification + one-time XP bonus couldn't exist at all — every
// GET would either fire nothing or fire the same notification forever.
export const EducationStudentAchievement = sequelize.define(
  "EducationStudentAchievement",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    student_profile_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: EducationStudentProfile,
        key: "student_profile_id",
      },
    },
    // Matches one of the fixed ids in progress_service.js's achievement
    // list ("first_steps", "quiz_whiz", ...) — not a foreign key, since
    // the achievement definitions themselves aren't a DB table (they're
    // real-signal conditions evaluated in code, not admin-authored rows).
    achievement_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    // Stored per-row rather than re-read from a shared constant at
    // display time, so a later change to the per-achievement bonus
    // amount never silently rewrites what a student already actually
    // earned in the past.
    bonus_xp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    unlocked_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "education_student_achievements",
    underscored: true,
    timestamps: false,
    indexes: [{ unique: true, fields: ["student_profile_id", "achievement_id"], name: "education_student_achievements_profile_achievement_uq" }],
  }
);

export default EducationStudentAchievement;
