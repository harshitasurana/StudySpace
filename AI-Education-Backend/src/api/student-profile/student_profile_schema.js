import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import User from "../user/user_schema.js";
import Role from "../roles/role_schema.js";
import { EducationAcademicBoard, EducationAcademicClass, EducationAcademicSubject } from "../academic/academic_schema.js";

export const EducationStudentProfile = sequelize.define(
  "EducationStudentProfile",
  {
    student_profile_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      // One profile per user — self-student and school-student onboarding
      // both write to the same row (create-or-update), never a second row.
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
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
    board_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: EducationAcademicBoard,
        key: "board_id",
      },
    },
    class_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: EducationAcademicClass,
        key: "class_id",
      },
    },
    section: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // Free-text school name — the schools registry/verification module
    // has been removed, so this is no longer resolved against a school_id.
    school_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    roll_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    learning_mode: {
      type: DataTypes.ENUM("self", "school"),
      allowNull: false,
      defaultValue: "self",
    },
    academic_year: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // Not in the original plan's column list — added so the self-student
    // wizard's "Student Code" completion screen (SelfStudentWizard.jsx)
    // has a real, persisted value to show instead of the client-side
    // 'STU-XXXXX-XXXX' placeholder. Generated once, on first profile
    // creation; never regenerated on update.
    student_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM("in_progress", "completed"),
      allowNull: false,
      defaultValue: "in_progress",
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Guided Walkthrough — one-time interactive tour, self-mode only (see
    // guided_walkthrough_service.js). NULL = never shown; a timestamp
    // means it was completed or dismissed, either way "seen" and never
    // shown again.
    guided_walkthrough_seen_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Legacy subscription/paywall FK column — the subscription system has
    // been removed (this deployment is fully local and unpaywalled), so
    // this is no longer written to or associated with any model. Left as
    // a plain nullable column rather than dropped, to avoid an unrelated
    // migration in this change.
    subscription_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Set once, the first time this student's subscription ever
    // transitions Free -> Pro/School (subscription_service.js's
    // isRealUpgrade block) — NEVER cleared on a later downgrade/lapse.
    // resolveChapterAccess (content_access_service.js) checks this before
    // the live subscription tier specifically so a chapter a student
    // already unlocked can't silently re-lock itself just because their
    // subscription later lapsed or was downgraded.
    pro_access_unlocked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "education_student_profiles",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export const EducationStudentSubject = sequelize.define(
  "EducationStudentSubject",
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
    subject_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: EducationAcademicSubject,
        key: "subject_id",
      },
    },
  },
  {
    tableName: "education_student_subjects",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ["student_profile_id", "subject_id"],
      },
    ],
  }
);

EducationStudentProfile.associate = (models) => {
  EducationStudentProfile.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
  EducationStudentProfile.belongsTo(models.Role, { foreignKey: "role_id", as: "role" });
  EducationStudentProfile.belongsTo(models.EducationAcademicBoard, { foreignKey: "board_id", as: "board" });
  EducationStudentProfile.belongsTo(models.EducationAcademicClass, { foreignKey: "class_id", as: "class" });
  EducationStudentProfile.hasMany(models.EducationStudentSubject, {
    foreignKey: "student_profile_id",
    as: "studentSubjects",
  });
  EducationStudentProfile.belongsToMany(models.EducationAcademicSubject, {
    through: models.EducationStudentSubject,
    foreignKey: "student_profile_id",
    otherKey: "subject_id",
    as: "subjects",
  });
  EducationStudentProfile.hasOne(models.EducationLearningPreference, {
    foreignKey: "student_profile_id",
    as: "preferences",
  });
};

EducationStudentSubject.associate = (models) => {
  EducationStudentSubject.belongsTo(models.EducationStudentProfile, {
    foreignKey: "student_profile_id",
    as: "studentProfile",
  });
  EducationStudentSubject.belongsTo(models.EducationAcademicSubject, {
    foreignKey: "subject_id",
    as: "subject",
  });
};

export default { EducationStudentProfile, EducationStudentSubject };
