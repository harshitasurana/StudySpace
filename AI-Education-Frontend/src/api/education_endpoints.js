// Education-specific endpoints. Kept separate from the main endpoints.js so
// it's obvious which routes are real today vs. pending backend work.
//
// NOTE: these are flat under /api/<module> (no /education segment) to match
// the backend's actual route mounting in app.js:
//   app.use("/api/onboarding", onboardingRoutes)
//   app.use("/api/academic", academicRoutes)
//   app.use("/api/student-profile", studentProfileRoutes)
//   app.use("/api/preferences", preferencesRoutes)
// which itself matches the flat api/<module> folder convention used
// everywhere else in the backend (api/roles, api/ambulance, etc. — no
// nested api/education/* umbrella folder).
//
// STATUS:
//   roles.public / roles.setOwnRole                       -> LIVE (Sprint 0, platform)
//   onboarding.config / academic.* / studentProfile.* /
//   preferences.save                                      -> LIVE (Sprint 1)
//   curriculum.*                                          -> LIVE (Sprint 2)

export const EDUCATION_ENDPOINTS = {
  roles: {
    // Self-service — any authenticated user can call this, returns only
    // roles flagged is_self_assignable (e.g. Student).
    public: (categoryId) =>
      categoryId ? `/api/roles/public?category_id=${categoryId}` : '/api/roles/public',
    // Self-service — sets the CALLER's own role_id. Body: { role_id }.
    setOwnRole: '/api/users/me/role',
  },
  onboarding: {
    // Returns the step manifest for the given role/persona. learningMode
    // ('self' | 'school') only matters for the Student role — omit it for
    // the initial role-selection call.
    config: (roleId, learningMode) =>
      learningMode
        ? `/api/onboarding/config?role_id=${roleId}&learning_mode=${learningMode}`
        : `/api/onboarding/config?role_id=${roleId}`,
  },
  academic: {
    boards: '/api/academic/boards',
    classes: (boardId) =>
      boardId ? `/api/academic/classes?board_id=${boardId}` : '/api/academic/classes',
    subjects: (boardId, classId) => {
      const params = new URLSearchParams();
      if (boardId) params.set('board_id', boardId);
      if (classId) params.set('class_id', classId);
      const qs = params.toString();
      return qs ? `/api/academic/subjects?${qs}` : '/api/academic/subjects';
    },
  },
  curriculum: {
    // class_id is deliberately omitted — for a student caller the backend
    // resolves it server-side from their own profile. includeNcertAvailability:
    // pass true only where has_ncert_solutions/has_ncert_notes are actually
    // shown (LearningPath.jsx) — it costs a live HTTP call per chapter
    // server-side; leave it false (default) everywhere else.
    chapters: (subjectId, includeNcertAvailability = false) => {
      const query = new URLSearchParams();
      query.set('subject_id', subjectId);
      if (includeNcertAvailability) query.set('include_ncert_availability', 'true');
      return `/api/curriculum/chapters?${query.toString()}`;
    },
    progress: (studentProfileId) => `/api/curriculum/progress/${studentProfileId}`,
    // The reader renders the real chapter PDF directly (react-pdf) — meta
    // is just name/order/subject for the page header; pdf streams the
    // actual file bytes (fetched via apiClient so the auth token is
    // attached, then handed to react-pdf as raw data, not a bare URL).
    chapterMeta: (chapterId) => `/api/curriculum/chapters/${chapterId}/meta`,
    chapterPdf: (chapterId) => `/api/curriculum/chapters/${chapterId}/pdf`,
    // Real NCERT Solutions/Notes PDFs, rendered the same way as the
    // textbook — not every chapter has these yet (pilot: Math Chapter 1
    // only), a 404 here is a normal "not available" state, not an error.
    ncertSolutionsPdf: (chapterId) => `/api/curriculum/chapters/${chapterId}/ncert-solutions-pdf`,
    ncertNotesPdf: (chapterId) => `/api/curriculum/chapters/${chapterId}/ncert-notes-pdf`,
    // {"1.1": {"textbook_pages": [3,5], "questions": [{"number": 1,
    // "solution_page": 0}, ...]}, ...} — drives the in-context "jump to
    // solution" banner and the NCERT Solutions tab's Question Index.
    ncertSolutionsIndex: (chapterId) => `/api/curriculum/chapters/${chapterId}/ncert-solutions-index`,
  },
  aiTutor: {
    chat: '/api/ai-tutor/chat',
    chatImage: '/api/ai-tutor/chat/image',
    // conversationId omitted -> the chapter's most recent conversation
    // (or start one); passed -> that exact past conversation, for AI
    // Sessions resuming a specific old chat.
    history: (chapterId, conversationId) =>
      conversationId
        ? `/api/ai-tutor/history/${chapterId}?conversation_id=${conversationId}`
        : `/api/ai-tutor/history/${chapterId}`,
    newConversation: (chapterId) => `/api/ai-tutor/history/${chapterId}/new`,
    conversations: '/api/ai-tutor/conversations',
  },
  quiz: {
    generate: '/api/quiz/generate',
    submit: (attemptId) => `/api/quiz/${attemptId}/submit`,
    status: (attemptId) => `/api/quiz/attempts/${attemptId}/status`,
    attempts: (attemptType, includeGenerating) => {
      const query = new URLSearchParams();
      if (attemptType) query.set('attempt_type', attemptType);
      if (includeGenerating) query.set('include_generating', 'true');
      const qs = query.toString();
      return qs ? `/api/quiz/attempts?${qs}` : '/api/quiz/attempts';
    },
    mistakes: (params = {}) => {
      const query = new URLSearchParams();
      if (params.subjectId) query.set('subject_id', params.subjectId);
      if (params.attemptType) query.set('attempt_type', params.attemptType);
      const qs = query.toString();
      return qs ? `/api/quiz/mistakes?${qs}` : '/api/quiz/mistakes';
    },
    testReview: '/api/quiz/test-review',
  },
  progress: {
    overview: '/api/progress/overview',
    subjects: '/api/progress/subjects',
    achievements: '/api/progress/achievements',
    gameStats: '/api/progress/game-stats',
  },
  notes: {
    list: (chapterId) => (chapterId ? `/api/education/notes?chapter_id=${chapterId}` : '/api/education/notes'),
    create: '/api/education/notes',
    update: (noteId) => `/api/education/notes/${noteId}`,
    remove: (noteId) => `/api/education/notes/${noteId}`,
  },
  bookmarks: {
    list: (params = {}) => {
      const query = new URLSearchParams();
      if (params.chapterId) query.set('chapter_id', params.chapterId);
      if (params.collection) query.set('collection', params.collection);
      const qs = query.toString();
      return qs ? `/api/education/bookmarks?${qs}` : '/api/education/bookmarks';
    },
    create: '/api/education/bookmarks',
    update: (bookmarkId) => `/api/education/bookmarks/${bookmarkId}`,
    remove: (bookmarkId) => `/api/education/bookmarks/${bookmarkId}`,
  },
  highlights: {
    list: (chapterId) => `/api/education/highlights?chapter_id=${chapterId}`,
    create: '/api/education/highlights',
    remove: (highlightId) => `/api/education/highlights/${highlightId}`,
  },
  flashcards: {
    generate: '/api/flashcards/generate',
    sets: '/api/flashcards/sets',
    status: (setId) => `/api/flashcards/sets/${setId}/status`,
  },
  studyPlan: {
    get: '/api/study-plan',
  },
  mindmap: {
    generate: '/api/mindmap/generate',
    status: '/api/mindmap/status',
    list: '/api/mindmap/list',
  },
  slideDeck: {
    generate: '/api/slide-deck/generate',
    status: '/api/slide-deck/status',
    list: '/api/slide-deck/list',
  },
  infographic: {
    generate: '/api/infographic/generate',
    status: '/api/infographic/status',
  },
  voice: {
    turn: '/api/voice/turn',
  },
  // Mounted at /api/my-calendar (not /api/calendar) — that prefix already
  // belongs to an unrelated generic CRM calendar module from the base
  // platform template this backend was forked from.
  myCalendar: {
    events: '/api/my-calendar/events',
    createExam: '/api/my-calendar/events/exam',
    event: (id) => `/api/my-calendar/events/${id}`,
    upcoming: '/api/my-calendar/upcoming',
    upcomingExams: '/api/my-calendar/exams/upcoming',
  },
  studentProfile: {
    // GET and POST both hit this same URL — get() fetches the caller's
    // existing profile (used for mode-aware routing, doesn't require
    // onboarding to be marked complete), create() upserts it.
    get: '/api/student-profile',
    create: '/api/student-profile',
    complete: '/api/student-profile/complete',
    update: (id) => `/api/student-profile/${id}`,
    markGuidedWalkthroughSeen: '/api/student-profile/guided-walkthrough-seen',
  },
  preferences: {
    save: '/api/preferences',
  },
  dashboard: '/api/student-dashboard',
  samplePapers: {
    list: (subjectId) => (subjectId ? `/api/sample-papers?subject_id=${subjectId}` : '/api/sample-papers'),
    detail: (samplePaperId) => `/api/sample-papers/${samplePaperId}`,
    startAttempt: (samplePaperId) => `/api/sample-papers/${samplePaperId}/attempts`,
    answerPdf: (attemptId) => `/api/sample-papers/attempts/${attemptId}/answer-pdf`,
    submit: (attemptId) => `/api/sample-papers/attempts/${attemptId}/submit`,
    attempt: (attemptId) => `/api/sample-papers/attempts/${attemptId}`,
    attempts: '/api/sample-papers/attempts',
  },
  siteFeedback: {
    submit: '/api/site-feedback',
  },
};

export default EDUCATION_ENDPOINTS;