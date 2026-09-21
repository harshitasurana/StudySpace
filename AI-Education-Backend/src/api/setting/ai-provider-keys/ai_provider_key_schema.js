import { DataTypes } from "sequelize";
import sequelize from "../../../config/database.js";

const AiProviderKey = sequelize.define(
  "AiProviderKey",
  {
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "gemini",
    },
    label: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    // Nullable — local providers (ollama/lm_studio/vllm) have no key.
    api_key: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Exact model identifier for this key/provider (e.g. "gpt-4o",
    // "claude-3-5-sonnet-20240620", "llama3.1") — was a single global
    // GEMINI_MODEL env var before; now per-key so different providers/
    // keys can each run their own model.
    model: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    // Custom endpoint — required for local providers (no fixed default)
    // and OpenAI-compatible "fast inference" clouds (Groq/Together/
    // DeepSeek/OpenRouter — llm_provider.py falls back to each one's
    // well-known default when left blank). Not used by gemini/anthropic,
    // which have their own SDK-fixed endpoints.
    base_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    tier: {
      type: DataTypes.ENUM("free", "pro"),
      allowNull: false,
      defaultValue: "free",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "ai_provider_keys",
    timestamps: true,
    underscored: true,
  }
);

export default AiProviderKey;
