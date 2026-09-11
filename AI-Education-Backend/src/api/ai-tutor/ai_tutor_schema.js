import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationChapter } from "../curriculum/curriculum_schema.js";

// A student can have many conversations per chapter over time (see
// 20260816_ai_conversations_allow_multiple_per_chapter.sql - "New Chat"
// starts a new row rather than wiping the old one, so no conversation is
// ever lost). The most recent one for a chapter is the default/active
// thread; older ones stay browsable via AI Sessions.
export const AiConversation = sequelize.define(
  "AiConversation",
  {
    conversation_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    student_profile_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: EducationStudentProfile, key: "student_profile_id" } },
    chapter_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: EducationChapter, key: "chapter_id" } },
  },
  { tableName: "ai_conversations", underscored: true, timestamps: true, createdAt: "created_at", updatedAt: "updated_at" }
);

export const AiMessage = sequelize.define(
  "AiMessage",
  {
    message_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    conversation_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: AiConversation, key: "conversation_id" } },
    role: { type: DataTypes.ENUM("user", "assistant"), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    sources: { type: DataTypes.JSONB, allowNull: true },
    figures: { type: DataTypes.JSONB, allowNull: true },
    citations: { type: DataTypes.JSONB, allowNull: true },
    // Set only on a user message sent with an attached image — resolves
    // to a locally-stored file via fileStorage.service.js (see
    // STORAGE_CATEGORIES.AI_TUTOR_CHAT_IMAGE), not raw image bytes.
    image_key: { type: DataTypes.STRING, allowNull: true },
    // Always NULL — the student sent this themselves (every message
    // today). Left as a plain nullable column rather than dropped, to
    // avoid an unrelated migration.
    added_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "ai_messages", underscored: true, timestamps: true, createdAt: "created_at", updatedAt: false }
);

AiConversation.associate = (models) => {
  AiConversation.belongsTo(models.EducationStudentProfile, { foreignKey: "student_profile_id", as: "studentProfile" });
  AiConversation.belongsTo(models.EducationChapter, { foreignKey: "chapter_id", as: "chapter" });
  AiConversation.hasMany(models.AiMessage, { foreignKey: "conversation_id", as: "messages" });
};

AiMessage.associate = (models) => {
  AiMessage.belongsTo(models.AiConversation, { foreignKey: "conversation_id", as: "conversation" });
};

export default { AiConversation, AiMessage };
