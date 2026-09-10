import sequelize from '../config/database.js';

// Import all models
import Role from '../api/roles/role_schema.js';
import RoleTemplate from '../api/roles/role_template_schema.js';
import Feature from '../api/feature/feature_schema.js';
import FeaturePermission from '../api/feature/feature_permissions_schema.js';
import AvailabilityType from '../api/feature/feature_availability_schema.js';
import FeatureAvailability from '../api/feature/feature_availability_model.js';
import { CategoryType, Category } from '../api/metadata/category/category_schema.js';

import User from '../api/user/user_schema.js';
import Profile from '../api/profile/profile_schema.js';

// Import notification models
import { Notification, UserNotification } from '../api/profile/notification_schema.js';
import UserNotificationPreference from '../api/profile/notification_preference_schema.js';

// Import settings models
import AiProviderKey from '../api/setting/ai-provider-keys/ai_provider_key_schema.js';
import AiProviderSettings from '../api/setting/ai-provider-keys/ai_provider_settings_schema.js';

// Import user preferences model
import UserPreferences from '../api/user-preferences/user_preferences_schema.js';

// Import education models (Sprint 1 — Student Onboarding)
import {
  EducationAcademicBoard,
  EducationAcademicClass,
  EducationAcademicSubject,
} from '../api/academic/academic_schema.js';
import {
  EducationStudentProfile,
  EducationStudentSubject,
} from '../api/student-profile/student_profile_schema.js';
import { EducationLearningPreference } from '../api/preferences/preferences_schema.js';
import { EducationOnboardingSession } from '../api/onboarding/onboarding_schema.js';
import {
  EducationChapter,
  EducationStudentChapterProgress,
} from '../api/curriculum/curriculum_schema.js';
import { AiConversation, AiMessage } from '../api/ai-tutor/ai_tutor_schema.js';
import { QuizAttempt, QuizAnswer } from '../api/quiz/quiz_schema.js';
import { EducationStudentNote } from '../api/notes/notes_schema.js';
import { EducationStudentBookmark } from '../api/bookmarks/bookmarks_schema.js';
import { EducationChapterHighlight } from '../api/highlights/highlights_schema.js';
import { EducationBookIngestion } from '../api/admin/ingestion/ingestion_schema.js';
import { EducationStudentAchievement } from '../api/progress/student_achievement_schema.js';
import { EducationMindMap } from '../api/mindmap/mindmap_schema.js';
import { EducationMindMapView } from '../api/mindmap/mindmap_view_schema.js';
import { EducationSlideDeck } from '../api/slide-deck/slide_deck_schema.js';
import { EducationSlideDeckView } from '../api/slide-deck/slide_deck_view_schema.js';
import { EducationInfographic } from '../api/infographic/infographic_schema.js';
import { EducationCalendarEvent, EducationExamDetail, EducationExamChapter } from '../api/my-calendar/calendar_schema.js';
import { SamplePaper, SamplePaperSection, SamplePaperQuestion } from '../api/sample-papers/sample_paper_schema.js';
import { SamplePaperExtractionJob } from '../api/sample-papers/sample_paper_extraction_schema.js';
import { SamplePaperAttempt, SamplePaperResponse, SamplePaperGradingLog } from '../api/sample-papers/sample_paper_attempt_schema.js';
import { EducationFlashcardSet, EducationFlashcardSetView } from '../api/flashcards/flashcards_schema.js';

// Create models object
const models = {
  sequelize,
  Role,
  RoleTemplate,
  Feature,
  FeaturePermission,
  AvailabilityType,
  FeatureAvailability,
  User,
  Profile,
  // Settings models
  AiProviderKey,
  AiProviderSettings,
  // User preferences model
  UserPreferences,
  // Metadata models
  CategoryType,
  Category,
  // Notification models
  Notification,
  UserNotification,
  UserNotificationPreference,
  // Education models (Sprint 1 — Student Onboarding)
  EducationAcademicBoard,
  EducationAcademicClass,
  EducationAcademicSubject,
  EducationStudentProfile,
  EducationStudentSubject,
  EducationLearningPreference,
  EducationOnboardingSession,
  // Education models (Sprint 2 — Curriculum Foundation)
  EducationChapter,
  EducationStudentChapterProgress,
  // Education models (Sprint 3 — AI Tutor)
  AiConversation,
  AiMessage,
  // Education models (Sprint 4 — Quiz)
  QuizAttempt,
  QuizAnswer,
  // Education models (Sprint 7 — Notes/Bookmarks)
  EducationStudentNote,
  EducationStudentBookmark,
  EducationChapterHighlight,
  // Education models — admin content-ingestion
  EducationBookIngestion,
  EducationStudentAchievement,
  // Interactive RAG Mind Map — Phase 2 (pre-generated variants, cached)
  EducationMindMap,
  EducationMindMapView,
  // AI Learning Deck — Phase 1 (one grounded, purpose-driven slide deck
  // per chapter+scope, generated in the background)
  EducationSlideDeck,
  EducationSlideDeckView,
  // Infographic — a single-page, whole-chapter overview, generated in
  // the background (one per chapter+scope, exact same shape as the
  // AI Learning Deck above)
  EducationInfographic,
  // Academic Calendar ("My Calendar") — Phase 1 (self-student-owned
  // exams/assignments/study/revision events, exam<->chapter linking)
  EducationCalendarEvent,
  EducationExamDetail,
  EducationExamChapter,
  // Sample Papers — Stage 0 (admin authoring)
  SamplePaper,
  SamplePaperSection,
  SamplePaperQuestion,
  SamplePaperExtractionJob,
  SamplePaperAttempt,
  SamplePaperResponse,
  SamplePaperGradingLog,
  EducationFlashcardSet,
  EducationFlashcardSetView,
};

// Define associations once per unique model reference.
const associatedModels = new Set();
Object.keys(models).forEach((modelName) => {
  const model = models[modelName];
  if (model?.associate && !associatedModels.has(model)) {
    associatedModels.add(model);
    model.associate(models);
  }
});

export { sequelize };
export default models;