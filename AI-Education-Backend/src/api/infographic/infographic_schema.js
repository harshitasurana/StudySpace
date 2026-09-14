import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";

// Node owns this table — one Infographic per (chapter_id, board,
// standard), exact mirror of education_slide_decks. RAGProductionApp
// does the actual generation, always via its Celery worker
// (core/infographic_tasks.py — no synchronous variant), and never
// persists an infographic itself; the worker reports its outcome back
// here via POST /api/infographic/callback/:infographicId.

export const EducationInfographic = sequelize.define(
  "EducationInfographic",
  {
    infographic_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    chapter_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: EducationChapter,
        key: "chapter_id",
      },
    },
    board: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    standard: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "processing", "completed", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    // { chapter_title, big_picture, key_concepts: [{ title, summary,
    //   image_required, visual_query, visual, citation, image }],
    //   formulas: [{ name, expression, when_to_use, citation }],
    //   definitions: [{ term, meaning, citation }],
    //   common_mistakes: [{ mistake, correction, citation }],
    //   exam_tips: [str], quick_recap: [str] } — null until status is
    // "completed".
    payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    generated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "education_infographics",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [{ unique: true, fields: ["chapter_id", "board", "standard"] }],
  }
);

EducationInfographic.associate = (models) => {
  EducationInfographic.belongsTo(models.EducationChapter, { foreignKey: "chapter_id", as: "chapter" });
};

export default EducationInfographic;
