import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';
import { logInfo } from './common/utils/logger.js';
import cookieParser from 'cookie-parser';

// Routes
import userRoutes from './api/user/user_routes.js';
import profileRoutes from './api/profile/profile_routes.js';
import roleRoutes from "./api/roles/role_routes.js";
import featureRoutes from './api/feature/feature_routes.js';
import featurePermissionsRoutes from './api/feature/feature_permissions_routes.js';
import availabilityTypeRoutes from './api/feature/feature_availability_routes.js';
import metadataRoutes from './api/metadata/metadata_routes.js';
import userPreferencesRoutes from './api/user-preferences/user_preferences_routes.js';
import menuRoutes from './api/menu/menu_routes.js';
import searchRoutes from './api/search/search_routes.js';
import onboardingRoutes from "./api/onboarding/onboarding_routes.js";
import academicRoutes from "./api/academic/academic_routes.js";
import studentProfileRoutes from "./api/student-profile/student_profile_routes.js";
import preferencesRoutes from "./api/preferences/preferences_routes.js";
import curriculumRoutes from "./api/curriculum/curriculum_routes.js";
import studentDashboardRoutes from "./api/dashboards/students/student_dashboard_routes.js";
import aiTutorRoutes from "./api/ai-tutor/ai_tutor_routes.js";
import quizRoutes from "./api/quiz/quiz_routes.js";
import progressRoutes from "./api/progress/progress_routes.js";
import educationNotesRoutes from "./api/notes/notes_routes.js";
import educationBookmarksRoutes from "./api/bookmarks/bookmarks_routes.js";
import educationHighlightsRoutes from "./api/highlights/highlights_routes.js";
import flashcardsRoutes from "./api/flashcards/flashcards_routes.js";
import studyPlanRoutes from "./api/study-plan/study_plan_routes.js";
import mindmapRoutes from "./api/mindmap/mindmap_routes.js";
import slideDeckRoutes from "./api/slide-deck/slide_deck_routes.js";
import infographicRoutes from "./api/infographic/infographic_routes.js";
import voiceRoutes from "./api/voice/voice_routes.js";
import myCalendarRoutes from "./api/my-calendar/calendar_routes.js";
import ingestionRoutes from "./api/admin/ingestion/ingestion_routes.js";
import userActivityRoutes from "./api/admin/user-activity/user_activity_routes.js";
import aiProviderKeysRoutes from "./api/setting/ai-provider-keys/ai_provider_keys.routes.js";
import samplePaperAdminRoutes from "./api/sample-papers/sample_paper_admin_routes.js";
import samplePaperRoutes from "./api/sample-papers/sample_paper_routes.js";

// Middlewares
import { errorHandler } from './common/middlewares/error_handler.js';

// // Load environment variables
// if (process.env.NODE_ENV === "dev") {
//   dotenv.config({path: '.env.dev'});
// }else if (process.env.NODE_ENV === "local") {
//   dotenv.config({ path: '.env.local' });
// }

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize express app 
const app = express();

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:4200', 'http://localhost:3000'];

// Setup CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server or tools like Postman
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Client-Type',
  ],
  credentials: true
}));

// Parse incoming JSON
app.use(express.json());

// Parse URL-encoded data (for form submissions)
app.use(express.urlencoded({ extended: true }));

// Parse cookies for httpOnly JWT token support
app.use(cookieParser());

// ✅ SERVE STATIC FILES (Avatar uploads)
app.use(
  '/uploads/avatars',
  (req, res, next) => {
    // Firefox & Chrome require this for cross-origin image loading
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, '..', 'uploads', 'avatars'))
);
app.use('/uploads/photos', (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(__dirname, '..', 'uploads', 'photos'))
);
app.use('/uploads/documents', (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(__dirname, '..', 'uploads', 'documents'))
);
// AI Tutor chat image attachments (see STORAGE_CATEGORIES.AI_TUTOR_CHAT_IMAGE
// in fileStorage.service.js) — under the local storage driver,
// resolveStoredFileUrl's "signed" URL is really just this same plain path
// (LocalStorageProvider has no real signing), so it only resolves to a
// real image if a static mount exists for the category's path prefix,
// same as every other category above.
app.use('/uploads/ai-tutor', (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(__dirname, '..', 'uploads', 'ai-tutor'))
);
// Optional: Log static file requests for debugging
app.use('/uploads/avatars', (req, res, next) => {
  logInfo('📁 Static file(avatar) requested:', { url: req.url });
  next();
});
app.use('/uploads/photos', (req, res, next) => {
  logInfo('📁 Static file(photos) requested:', { url: req.url })
  next()
});
app.use('/uploads/documents', (req, res, next) => {
  logInfo('Static file(documents) requested:', { url: req.url })
  next()
});

// Swagger API docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// =====================
// Base & Health routes
// =====================
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'education-api',
    status: 'running',
    environment: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok'
  });
});

// Register your routes
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use("/api/roles", roleRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/feature-permissions', featurePermissionsRoutes);
app.use('/api/feature-availability-types', availabilityTypeRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/user-preferences', userPreferencesRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/search', searchRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/academic", academicRoutes);
app.use("/api/student-profile", studentProfileRoutes);
app.use("/api/preferences", preferencesRoutes);
app.use("/api/curriculum", curriculumRoutes);
app.use("/api/student-dashboard", studentDashboardRoutes);
app.use("/api/ai-tutor", aiTutorRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/education/notes", educationNotesRoutes);
app.use("/api/education/bookmarks", educationBookmarksRoutes);
app.use("/api/education/highlights", educationHighlightsRoutes);
app.use("/api/flashcards", flashcardsRoutes);
app.use("/api/study-plan", studyPlanRoutes);
app.use("/api/mindmap", mindmapRoutes);
app.use("/api/slide-deck", slideDeckRoutes);
app.use("/api/infographic", infographicRoutes);
app.use("/api/voice", voiceRoutes);
// NOT /api/calendar — that prefix already belongs to an unrelated generic
// CRM calendar module from the base platform template (see
// calendar_schema.js's own comment).
app.use("/api/my-calendar", myCalendarRoutes);
app.use("/api/admin/ingestion", ingestionRoutes);
app.use("/api/admin/user-activity", userActivityRoutes);
app.use("/api/admin/ai-provider-keys", aiProviderKeysRoutes);
app.use("/api/admin/sample-papers", samplePaperAdminRoutes);
app.use("/api/sample-papers", samplePaperRoutes);
// Global error handler (must be last)
app.use(errorHandler);

export default app;