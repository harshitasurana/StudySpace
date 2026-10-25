import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationAcademicSubject, EducationAcademicClass } from "../academic/academic_schema.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";

// Stage 0 (admin authoring) — see the migration's header comment for the
// full rationale. question_type / question_media / input_type /
// grading_strategy on SamplePaperQuestion are deliberately independent
// columns, not derived from one another.

export const SamplePaper = sequelize.define(
  "SamplePaper",
  {
    sample_paper_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
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
    paper_type: {
      type: DataTypes.ENUM("major_test", "semi_major"),
      allowNull: false,
    },
    source_pdf_key: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    source_solution_pdf_key: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    total_marks: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("draft", "pending_review", "published", "archived"),
      allowNull: false,
      defaultValue: "draft",
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    approved_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "sample_papers",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export const SamplePaperSection = sequelize.define(
  "SamplePaperSection",
  {
    section_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sample_paper_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SamplePaper,
        key: "sample_paper_id",
      },
    },
    section_label: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    marks_per_question: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    order_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "sample_paper_sections",
    underscored: true,
    timestamps: false,
  }
);

export const SamplePaperQuestion = sequelize.define(
  "SamplePaperQuestion",
  {
    question_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sample_paper_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SamplePaper,
        key: "sample_paper_id",
      },
    },
    section_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: SamplePaperSection,
        key: "section_id",
      },
    },
    question_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    question_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    question_type: {
      type: DataTypes.ENUM("short_answer", "long_answer", "numerical", "diagram_based"),
      allowNull: false,
    },
    question_media: {
      type: DataTypes.ENUM("none", "image"),
      allowNull: false,
      defaultValue: "none",
    },
    question_media_key: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    input_type: {
      type: DataTypes.ENUM("typed", "photo", "typed_or_photo"),
      allowNull: false,
    },
    grading_strategy: {
      type: DataTypes.ENUM(
        "exact",
        "numeric",
        "rubric",
        "handwriting_rubric",
        "diagram_rubric",
        "graph_rubric"
      ),
      allowNull: false,
    },
    max_marks: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    model_answer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Array of { criterion, marks } summing to max_marks — the structured
    // grading ground truth (see grading_strategy -> prompt mapping).
    rubric_criteria: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    rubric_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Whether model_answer/rubric_criteria came from the real Solution PDF
    // (expected default) or the RAG-drafted fallback — drives the "AI
    // drafted, not from the teacher's solution" flag in the review UI.
    answer_source: {
      type: DataTypes.ENUM("solution_matched", "rag_drafted", "unmatched"),
      allowNull: false,
      defaultValue: "unmatched",
    },
    concept_tags: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    difficulty: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    chapter_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: EducationChapter,
        key: "chapter_id",
      },
    },
    review_status: {
      type: DataTypes.ENUM("ai_extracted", "admin_edited", "approved"),
      allowNull: false,
      defaultValue: "ai_extracted",
    },
  },
  {
    tableName: "sample_paper_questions",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

SamplePaper.associate = (models) => {
  SamplePaper.belongsTo(models.EducationAcademicSubject, { foreignKey: "subject_id", as: "subject" });
  SamplePaper.belongsTo(models.EducationAcademicClass, { foreignKey: "class_id", as: "class" });
  SamplePaper.hasMany(models.SamplePaperSection, { foreignKey: "sample_paper_id", as: "sections" });
  SamplePaper.hasMany(models.SamplePaperQuestion, { foreignKey: "sample_paper_id", as: "questions" });
};

SamplePaperSection.associate = (models) => {
  SamplePaperSection.belongsTo(models.SamplePaper, { foreignKey: "sample_paper_id", as: "samplePaper" });
  SamplePaperSection.hasMany(models.SamplePaperQuestion, { foreignKey: "section_id", as: "questions" });
};

SamplePaperQuestion.associate = (models) => {
  SamplePaperQuestion.belongsTo(models.SamplePaper, { foreignKey: "sample_paper_id", as: "samplePaper" });
  SamplePaperQuestion.belongsTo(models.SamplePaperSection, { foreignKey: "section_id", as: "section" });
  SamplePaperQuestion.belongsTo(models.EducationChapter, { foreignKey: "chapter_id", as: "chapter" });
};

export default { SamplePaper, SamplePaperSection, SamplePaperQuestion };
