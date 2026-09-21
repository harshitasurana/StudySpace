import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationSlideDeck } from "./slide_deck_schema.js";

// Per-student "I've generated/received this slide deck" record — direct
// mirror of flashcards_schema.js's EducationFlashcardSetView. Powers each
// student's own "My Learning Decks" history in listSlideDecksService,
// bumped (upserted) every time a student's request resolves to a pool
// row, whether they triggered the generation or reused an existing one.
export const EducationSlideDeckView = sequelize.define(
  "EducationSlideDeckView",
  {
    student_profile_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: EducationStudentProfile, key: "student_profile_id" },
    },
    slide_deck_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: EducationSlideDeck, key: "slide_deck_id" },
    },
    viewed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "education_slide_deck_views",
    underscored: true,
    timestamps: false,
  }
);

EducationSlideDeckView.associate = (models) => {
  EducationSlideDeckView.belongsTo(models.EducationStudentProfile, { foreignKey: "student_profile_id", as: "studentProfile" });
  EducationSlideDeckView.belongsTo(models.EducationSlideDeck, { foreignKey: "slide_deck_id", as: "deck" });
};

export default EducationSlideDeckView;
