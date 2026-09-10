import { DataTypes } from "sequelize";
import sequelize from "../../../config/database.js";
import { EducationChapter } from "../../curriculum/curriculum_schema.js";

// Node owns this table — status/progress for an async chapter-processing
// job an admin triggers. FastAPI (RAGProductionApp) does the actual work
// and calls back into Node (POST /api/admin/ingestion/callback/:jobId) to
// report the outcome; it never persists this itself, matching this
// codebase's "Node owns identity/persistence, FastAPI is stateless
// per-request" convention.
//
// One table covers all three job types (job_type: text/images/enrich)
// rather than three sibling tables — mirrors SamplePaperExtractionJob's
// own convention of type-varying nullable columns in one table. Mind map
// / slide deck generation don't get their own job_type here — they
// already track their own status via EducationMindMap/EducationSlideDeck;
// a 'text' row's also_generate column just remembers to trigger them once
// that row completes (see recordIngestionCallbackService).

export const EducationBookIngestion = sequelize.define(
  "EducationBookIngestion",
  {
    id: {
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
    job_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "text",
    },
    status: {
      type: DataTypes.ENUM("pending", "processing", "completed", "failed", "paused"),
      allowNull: false,
      defaultValue: "pending",
    },
    // Polled by the running Celery images task once per page — set by
    // POST /:jobId/pause, cleared once that task actually reports back
    // status: 'paused' (or on resume). See image_ingestion_tasks.py's
    // _check_pause_requested.
    pause_requested: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    source_filename: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    storage_key: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    chunks_ingested: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Generic progress counter for images/enrich jobs (visuals ingested /
    // visuals enriched) — chunks_ingested stays text-only for backward
    // compatibility with rows/consumers that already expect that name.
    // Doubles as the running "N of total_items done" count while a job is
    // still 'processing' (updated via the interim progress callback, see
    // recordIngestionProgressService), not just the final tally.
    items_processed: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // The denominator for items_processed while a job is 'processing'
    // (e.g. total pages for image ingestion, total visuals discovered for
    // enrichment) — null until the task knows it, and never meaningful
    // once a job reaches a terminal status.
    total_items: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Human-readable "what's happening right now" (e.g. "Layout Detection
    // — page 4 of 15", "Analyzing with Qwen Vision"), updated by the same
    // interim progress callback. Never meaningful once a job reaches a
    // terminal status — the admin UI only shows it while status is
    // 'processing'.
    current_stage: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // Set only on a 'text' row: which admin-requested follow-ups
    // (["mindmap","slidedeck"]) to trigger once this row completes.
    also_generate: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    // Set only on a job created "pending" because a prerequisite job
    // (e.g. 'images' for this row's 'enrich') hasn't completed yet — the
    // prerequisite's own completion callback is what actually triggers
    // this row (see recordIngestionCallbackService), not a timer/poller.
    waits_for_job_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "education_book_ingestions",
        key: "id",
      },
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    requested_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Real timestamped log history for the Ingestion Monitor — every
    // status transition and progress ping appends an entry here instead
    // of overwriting current_stage in place, so a job's full timeline
    // survives after the fact. Capped at the most recent 200 entries
    // (see appendJobLog in ingestion_service.js) — a running log, not an
    // unbounded audit trail.
    logs: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    tableName: "education_book_ingestions",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

EducationBookIngestion.associate = (models) => {
  EducationBookIngestion.belongsTo(models.EducationChapter, { foreignKey: "chapter_id", as: "chapter" });
  EducationBookIngestion.belongsTo(models.EducationBookIngestion, { foreignKey: "waits_for_job_id", as: "waitsForJob" });
  // Who triggered this job — the Ingestion Monitor shows it per row.
  EducationBookIngestion.belongsTo(models.User, { foreignKey: "requested_by", as: "requestedByUser" });
};

export default EducationBookIngestion;
