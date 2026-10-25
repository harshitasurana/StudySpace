import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

// GLOBAL TABLES — academic metadata (boards / classes / subjects).
// Shared, reusable master data — not scoped to a user, organization, or
// student. education_student_subjects (in student_profile_schema.js) is
// the join table linking a student's profile to these subjects.

export const EducationAcademicBoard = sequelize.define(
  "EducationAcademicBoard",
  {
    board_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    code: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "education_academic_boards",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export const EducationAcademicClass = sequelize.define(
  "EducationAcademicClass",
  {
    class_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      // Display label, e.g. "Class 10" or "Dropper" — kept as a string
      // rather than assuming every board's classes are numeric.
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    grade_level: {
      // Numeric ordering hint for sorting selectors; null for non-numeric
      // entries like "Dropper".
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    board_id: {
      // Nullable: a class can be board-specific (e.g. an IB-only grade
      // label) or generic/shared across boards.
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: EducationAcademicBoard,
        key: "board_id",
      },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "education_academic_classes",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export const EducationAcademicSubject = sequelize.define(
  "EducationAcademicSubject",
  {
    subject_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(30),
      allowNull: true,
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
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "education_academic_subjects",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

EducationAcademicBoard.associate = (models) => {
  EducationAcademicBoard.hasMany(models.EducationAcademicClass, {
    foreignKey: "board_id",
    as: "classes",
  });
  EducationAcademicBoard.hasMany(models.EducationAcademicSubject, {
    foreignKey: "board_id",
    as: "subjects",
  });
};

EducationAcademicClass.associate = (models) => {
  EducationAcademicClass.belongsTo(models.EducationAcademicBoard, {
    foreignKey: "board_id",
    as: "board",
  });
  EducationAcademicClass.hasMany(models.EducationAcademicSubject, {
    foreignKey: "class_id",
    as: "subjects",
  });
};

EducationAcademicSubject.associate = (models) => {
  EducationAcademicSubject.belongsTo(models.EducationAcademicBoard, {
    foreignKey: "board_id",
    as: "board",
  });
  EducationAcademicSubject.belongsTo(models.EducationAcademicClass, {
    foreignKey: "class_id",
    as: "class",
  });
};

// Global search (Topbar) — see help_center_schema.js's searchConfig
// comment for how this gets picked up automatically.
EducationAcademicSubject.searchConfig = {
  key: "subjects",
  label: "Subjects",
  category: "learning",
  permissionFeatures: [],
  fields: ["name", "code", "description"],
  activeFilter: { is_active: true },
  display: {
    title: "name",
    subtitle: (row) => row.code || "Subject",
    description: "description",
  },
  route: () => "/my-learning/subjects",
  meta: (row) => ({ subject_id: row.subject_id, board_id: row.board_id, class_id: row.class_id }),
  order: [["name", "ASC"]],
};

export default {
  EducationAcademicBoard,
  EducationAcademicClass,
  EducationAcademicSubject,
};
