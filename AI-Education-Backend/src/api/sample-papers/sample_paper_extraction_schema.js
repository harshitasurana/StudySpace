import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { SamplePaper } from "./sample_paper_schema.js";

// Node owns this table — status/progress for the async Paper+Solution
// extraction job an admin triggers per sample paper. FastAPI
// (RAGProductionApp) does the actual page-image/vision extraction and
// calls back into Node (POST /api/admin/sample-papers/extraction-callback/:jobId)
// to report the outcome — same "Node owns identity/persistence, FastAPI is
// stateless per-request" convention as education_book_ingestions.

export const SamplePaperExtractionJob = sequelize.define(
  "SamplePaperExtractionJob",
  {
    id: {
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
    status: {
      type: DataTypes.ENUM("pending", "processing", "completed", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    source_filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    solution_filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    questions_extracted: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    requested_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "sample_paper_extraction_jobs",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

SamplePaperExtractionJob.associate = (models) => {
  SamplePaperExtractionJob.belongsTo(models.SamplePaper, { foreignKey: "sample_paper_id", as: "samplePaper" });
};

export default SamplePaperExtractionJob;
