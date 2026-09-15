import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";

// Node owns this table — 5 pre-generated mind-map variants per generation
// (one row each, tied together by generation_group_id). RAGProductionApp
// does the actual generation (synchronously for "concept_overview", via
// its Celery worker for the other 4) and never persists a mind map
// itself; the background variants report their outcome back here via
// POST /api/mindmap/callback/:mindMapId, matching this codebase's
// "Node owns identity/persistence, FastAPI is stateless per-request"
// convention already established by EducationBookIngestion.
//
// A chapter+board+standard scope can now hold MANY generation groups (a
// shared pool, mirroring EducationFlashcardSet) — see
// EducationMindMapView (mindmap_view_schema.js) for the per-student
// history/regeneration model, and 20260910f_add_mind_map_slide_deck_
// pools.sql for the migration that dropped the old one-group-per-scope
// unique constraint.

export const EducationMindMap = sequelize.define(
  "EducationMindMap",
  {
    mind_map_id: {
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
    variant: {
      type: DataTypes.ENUM(
        "concept_overview",
        "problem_solving_path",
        "compare_contrast",
        "building_blocks",
        "real_world_applications"
      ),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "processing", "completed", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    // { central_topic, branches: [{ label, type, citation, children: [...] }], relationships: [...] }
    // — null until status is "completed".
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
    // Ties the 5 variant rows from one generation call together as a
    // single browsable/listable "mind map" — see 20260910f_add_mind_map_
    // slide_deck_pools.sql. Multiple groups can now exist per
    // chapter+board+standard (the shared pool), unlike before this
    // migration when a unique constraint on those 3 columns (+variant)
    // guaranteed exactly one.
    generation_group_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "education_mind_maps",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

EducationMindMap.associate = (models) => {
  EducationMindMap.belongsTo(models.EducationChapter, { foreignKey: "chapter_id", as: "chapter" });
};

export default EducationMindMap;
