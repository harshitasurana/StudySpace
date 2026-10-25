import { DataTypes } from "sequelize";
import sequelize from "../../../config/database.js";

// Single-row table — which provider (from ai_provider_keys.provider) the
// AI Tutor actually calls right now. Separate from is_active/priority on
// individual keys: those control failover WITHIN a provider (try key A,
// then key B), this controls WHICH provider's keys get tried at all.
const AiProviderSettings = sequelize.define(
  "AiProviderSettings",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    active_provider: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "gemini",
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "ai_provider_settings",
    timestamps: true,
    updatedAt: "updated_at",
    createdAt: false,
    underscored: true,
  }
);

export default AiProviderSettings;
