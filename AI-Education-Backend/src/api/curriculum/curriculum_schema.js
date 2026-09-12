import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationAcademicSubject, EducationAcademicClass } from "../academic/academic_schema.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";

export const EducationChapter = sequelize.define(
  "EducationChapter",
  {
    chapter_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    subject_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: EducationAcademicSubject,
        key: "subject_id",
      },
    },
    class_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: EducationAcademicClass,
        key: "class_id",
      },
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    chapter_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    source_file: {
      // Used to feed the old manual scripts/ingest_books.py script directly
      // and had to be typed by hand. Now auto-generated server-side by the
      // real ingestion pipeline (see curriculum_service.js) when omitted —
      // nullable since a chapter can exist before any PDF is ever ingested.
      type: DataTypes.STRING(150),
      allowNull: true,
      unique: true,
    },
    academic_year: {
      // e.g. "2026-27". A revised syllabus gets a new chapter row tagged
      // with the new year rather than mutating the old one, so old and new
      // ingested content coexist instead of colliding in retrieval.
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    icon: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    // NULL for every subject with no such split (Math, Science, Social
    // Studies, ...). 'prose' | 'poetry' groups an English chapter into
    // its own Learning Path/Admin section — see the migration's own
    // comment for why this lives on the chapter row rather than a
    // separate table.
    content_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "education_chapters",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export const EducationStudentChapterProgress = sequelize.define(
  "EducationStudentChapterProgress",
  {
    progress_id: {
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
    chapter_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: EducationChapter,
        key: "chapter_id",
      },
    },
    progress_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("not_started", "in_progress", "completed"),
      allowNull: false,
      defaultValue: "not_started",
    },
    last_activity_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Remember-last-position: the reader resumes here on open when no
    // explicit ?page= deep link is present. Null until the student has
    // actually read at least one page.
    last_page_index: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Set once, the first time a student explicitly skips ahead and
    // unlocks a chapter past the real completion frontier (LearningPath.jsx)
    // — NEVER cleared afterward. Previously this "unlock" only lived in a
    // React useState Set that reset to empty on every reload/remount, so
    // the chapter silently re-locked itself the next time the page loaded.
    manually_unlocked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "education_student_chapter_progress",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

EducationChapter.associate = (models) => {
  EducationChapter.belongsTo(models.EducationAcademicSubject, { foreignKey: "subject_id", as: "subject" });
  EducationChapter.belongsTo(models.EducationAcademicClass, { foreignKey: "class_id", as: "class" });
  EducationChapter.hasMany(models.EducationStudentChapterProgress, {
    foreignKey: "chapter_id",
    as: "studentProgress",
  });
};

EducationStudentChapterProgress.associate = (models) => {
  EducationStudentChapterProgress.belongsTo(models.EducationStudentProfile, {
    foreignKey: "student_profile_id",
    as: "studentProfile",
  });
  EducationStudentChapterProgress.belongsTo(models.EducationChapter, {
    foreignKey: "chapter_id",
    as: "chapter",
  });
};

// Global search (Topbar) — see help_center_schema.js's searchConfig
// comment for how this gets picked up automatically.
EducationChapter.searchConfig = {
  key: "chapters",
  label: "Chapters",
  category: "learning",
  permissionFeatures: [],
  fields: ["name"],
  activeFilter: { is_active: true },
  display: {
    title: "name",
    subtitle: () => "Chapter",
  },
  // No per-chapter deep link today — lands on the Chapters list filtered
  // to this chapter's subject, same as the "View Learning Path" flow.
  route: (row) => `/my-learning/chapters?subject=${row.subject_id}`,
  meta: (row) => ({ chapter_id: row.chapter_id, subject_id: row.subject_id, class_id: row.class_id }),
  order: [["name", "ASC"]],
};

export default { EducationChapter, EducationStudentChapterProgress };
