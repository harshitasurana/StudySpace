import apiClient from './apiClient';
import { EDUCATION_ENDPOINTS } from '../api/education_endpoints';

const EducationService = {
  // ── LIVE (Sprint 0) ────────────────────────────────────────────────────

  // Returns only self-assignable roles (e.g. Student), optionally filtered
  // by category. Safe to call for any authenticated, non-admin user.
  async getPublicRoles(categoryId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.roles.public(categoryId));
    return data; // { success, data: [{ role_id, role_name, description, category_id }] }
  },

  // Sets the CALLER's own role. If that role has an organization_id
  // attached (e.g. Student -> Myntiq-Education), the backend also creates
  // the org membership automatically - no separate call needed here.
  async setOwnRole(roleId) {
    const { data } = await apiClient.put(EDUCATION_ENDPOINTS.roles.setOwnRole, { role_id: roleId });
    return data;
  },

  // ── LIVE (Sprint 1) ─────────────────────────────────────────────────────
  // Student onboarding: academic metadata, onboarding step manifest,
  // student profile create/complete, and learning preferences.

  async getOnboardingConfig(roleId, learningMode) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.onboarding.config(roleId, learningMode));
    return data;
  },

  async getBoards() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.academic.boards);
    return data;
  },

  async getClasses(boardId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.academic.classes(boardId));
    return data;
  },

  async getSubjects(boardId, classId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.academic.subjects(boardId, classId));
    return data;
  },

  // Fetches the caller's existing profile if any (404 if none yet). Does
  // NOT require onboarding to be complete — used for mode-aware routing
  // (self vs school), which needs to work even for an in-progress profile.
  async getMyProfile() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.studentProfile.get);
    return data;
  },

  // Create-or-update the CALLING user's student profile. Expects
  // { board_id, class_id, subject_ids: number[], learning_mode, academic_year? }.
  // Returns { success, message, data: { student_profile_id, student_code, ... } }.
  async createStudentProfile(payload) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.studentProfile.create, payload);
    return data;
  },

  // Marks the caller's student profile onboarding as complete.
  async completeStudentProfile() {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.studentProfile.complete);
    return data;
  },

  // Marks the caller's Guided Walkthrough as seen — called once the tour
  // finishes or is skipped, so it never shows again.
  async markGuidedWalkthroughSeen() {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.studentProfile.markGuidedWalkthroughSeen);
    return data;
  },

  async savePreferences(payload) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.preferences.save, payload);
    return data;
  },

  // From the persistent feedback widget available on every page —
  // pagePath is the route the student was on when they submitted it.
  async submitSiteFeedback({ message, pagePath, rating }) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.siteFeedback.submit, {
      message,
      page_path: pagePath,
      rating: rating ?? null,
    });
    return data;
  },

  // Real profile/preferences aggregation for the dashboard — no
  // mastery/streak/curriculum data (see Sprint 3 notes; that's a separate,
  // not-yet-designed system). Throws (via apiClient) a 403 if onboarding
  // isn't complete yet, or 404 if there's no profile at all.
  async getStudentDashboard() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.dashboard);
    return data;
  },

  // Chapters for a subject — class_id is resolved server-side from the
  // caller's own student profile, so only subject_id is needed here.
  // includeNcertAvailability: pass true only where has_ncert_solutions/
  // has_ncert_notes are actually shown (LearningPath.jsx) — it costs a
  // live HTTP call per chapter server-side; leave it false (default) for
  // a fast list everywhere else (dropdowns/pickers just need id/name/order).
  async getChapters(subjectId, includeNcertAvailability = false) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.curriculum.chapters(subjectId, includeNcertAvailability));
    return data; // { success, data: [{ chapter_id, subject_id, class_id, name, chapter_order, source_file, icon, is_active, has_ncert_solutions, has_ncert_notes }] }
  },

  // Chapter name/order/subject for the reader's header — the real body
  // content is the actual PDF (getChapterPdf below), rendered directly
  // in the browser rather than a transcribed/reformatted version.
  async getChapterMeta(chapterId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.curriculum.chapterMeta(chapterId));
    return data; // { success, data: { chapter_id, chapter_name, chapter_order, subject_id, subject_name, has_ncert_solutions, has_ncert_notes } }
  },

  // Fetches the chapter's real source PDF as raw bytes via the same
  // authenticated apiClient every other call here uses (rather than
  // handing react-pdf a bare URL, which wouldn't carry the auth token).
  async getChapterPdf(chapterId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.curriculum.chapterPdf(chapterId), {
      responseType: 'arraybuffer',
    });
    return data; // ArrayBuffer — pass directly to react-pdf's <Document file={data}>
  },

  // Same arraybuffer shape as getChapterPdf, pointed at the real NCERT
  // Solutions/Notes PDFs. Not every chapter has these yet — a 404 is
  // expected/normal (caller decides how to show "not available"), not
  // caught here so callers can tell a real failure apart from "none yet".
  async getNcertSolutionsPdf(chapterId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.curriculum.ncertSolutionsPdf(chapterId), {
      responseType: 'arraybuffer',
    });
    return data;
  },

  async getNcertNotesPdf(chapterId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.curriculum.ncertNotesPdf(chapterId), {
      responseType: 'arraybuffer',
    });
    return data;
  },

  // { "1.1": { textbook_pages: [3,5], questions: [{ number, solution_page }, ...] }, ... }
  async getNcertSolutionsIndex(chapterId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.curriculum.ncertSolutionsIndex(chapterId));
    return data; // { success, data: { ...index } }
  },

  // The caller's own chapter progress. The backend rejects any
  // studentProfileId that isn't the caller's own.
  async getChapterProgress(studentProfileId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.curriculum.progress(studentProfileId));
    return data; // { success, data: [{ progress_id, chapter_id, progress_percent, status, last_activity_at, last_page_index }] }
  },

  // Same route as getChapterProgress, PUT instead of GET. lastPageIndex is
  // how the reader implements "remember last position"; manuallyUnlocked is
  // how LearningPath.jsx persists an explicit "skip ahead" unlock so it
  // survives reloads — omit any field to leave it unchanged server-side
  // (upsertProgressService only updates fields that were actually sent).
  async updateChapterProgress(studentProfileId, { chapterId, progressPercent, status, lastPageIndex, manuallyUnlocked } = {}) {
    const { data } = await apiClient.put(EDUCATION_ENDPOINTS.curriculum.progress(studentProfileId), {
      chapter_id: chapterId,
      progress_percent: progressPercent,
      status,
      last_page_index: lastPageIndex,
      manually_unlocked: manuallyUnlocked,
    });
    return data;
  },

  // Sends a question for a chapter's persisted AI Tutor conversation
  // (server resolves student_profile_id/board/class — only chapter_id and
  // question are ever sent). conversationId is optional: omit to continue
  // the chapter's most recent conversation (or start one); pass one to
  // keep replying inside a specific past conversation (e.g. after
  // resuming one from AI Sessions). Returns { conversation_id, answer,
  // source, figures }.
  // chapterId may be null — "I don't know which chapter this is" mode.
  // subjectId is only read by the backend in that case (a real chapterId
  // already implies its own subject server-side); harmless to omit
  // otherwise. Response gains `identified_chapter: { chapter_id, name,
  // subject_name } | null` when chapterId was null.
  async chatWithTutor(chapterId, question, conversationId = null, subjectId = null) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.aiTutor.chat, {
      chapter_id: chapterId,
      subject_id: subjectId,
      question,
      conversation_id: conversationId,
    });
    return data;
  },

  // Image-attach counterpart to chatWithTutor — imageFile is whatever the
  // native file input handed back. Same optional-conversationId contract;
  // question may be empty (an image alone is a valid message). Content-Type
  // cleared the same way sendVoiceTurn/uploadSamplePaperAnswerPdf do, so
  // axios sets the real multipart boundary itself. Returns { conversation_id,
  // answer, source, figures, citations, image_url }.
  async chatWithTutorImage(chapterId, question, imageFile, conversationId = null, subjectId = null) {
    const formData = new FormData();
    formData.append('image', imageFile);
    if (chapterId) formData.append('chapter_id', chapterId);
    if (subjectId) formData.append('subject_id', subjectId);
    formData.append('question', question || '');
    if (conversationId) formData.append('conversation_id', conversationId);
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.aiTutor.chatImage, formData, {
      headers: { 'Content-Type': undefined },
    });
    return data;
  },

  // Push-to-talk voice turn — audioBlob is whatever MediaRecorder handed
  // back (webm/opus in Chrome, mp4 in Safari; the AI service transcodes
  // via faster-whisper's own decoder, no client-side conversion needed).
  // Same "same conversation, same messages list" contract as
  // chatWithTutor — a voice turn is just another message in the thread,
  // not a separate voice-only history. Content-Type cleared the same
  // way uploadSamplePaperAnswerPdf does, so axios sets the real
  // multipart boundary itself.
  async sendVoiceTurn(chapterId, audioBlob, conversationId = null) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'utterance.webm');
    formData.append('chapter_id', chapterId);
    if (conversationId) formData.append('conversation_id', conversationId);
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.voice.turn, formData, {
      headers: { 'Content-Type': undefined },
    });
    return data; // { success, data: { conversation_id, question_text, answer_text, source, figures, audio_base64, audio_format } }
  },

  // Prior persisted messages. conversationId omitted -> the chapter's
  // most recent conversation; passed -> that exact past conversation.
  async getTutorHistory(chapterId, conversationId = null) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.aiTutor.history(chapterId, conversationId));
    return data; // { success, data: { conversation_id, messages: [{ role, content, sources, figures, created_at }] } }
  },

  // "New chat" — starts a brand new conversation for this chapter. The
  // previous one is never deleted; every conversation stays saved and
  // browsable from AI Sessions.
  async startNewTutorConversation(chapterId) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.aiTutor.newConversation(chapterId));
    return data; // { success, data: { conversation_id } }
  },

  // Every real AI Tutor conversation the student has, across all
  // chapters — possibly several per chapter now — newest-first. This is
  // "AI Sessions".
  async listTutorConversations() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.aiTutor.conversations);
    return data; // { success, data: [{ conversation_id, chapter_id, chapter_name, subject_id, subject_name, message_count, notes_count, quiz_attempts_count, average_quiz_score, mistakes_count, started_at, last_active_at }] }
  },

  // Kicks off a real, chapter-grounded quiz generation as a background
  // job — returns immediately with { attempt_id, generation_status:
  // 'processing' }, NOT the questions themselves; poll getQuizStatus
  // (or use useGenerationPolling) until generation_status is 'completed'
  // or 'failed'. This keeps the attempt alive even if the student
  // navigates away mid-generation, since the row already exists before
  // this call returns. Returned questions never include
  // correct_answer/explanation — those only come back per-question from
  // submitQuizAnswer.
  // mode: 'standard' | 'formula' | 'concept' | 'challenge' — changes what
  // the AI service emphasizes when generating questions, still grounded
  // in the same chapter content. 'timed' Practice reuses 'standard'
  // generation with a client-side timer, not a distinct backend mode.
  // sourceText — set only when converting a note directly into a quiz:
  // generation is grounded in that exact text instead of chapter RAG.
  async generateQuiz(chapterId, numQuestions = 10, attemptType = 'quiz', mode = 'standard', sourceText = null) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.quiz.generate, {
      chapter_id: chapterId,
      num_questions: numQuestions,
      attempt_type: attemptType,
      mode,
      source_text: sourceText,
    });
    return data; // { success, data: { attempt_id, attempt_type, generation_status } }
  },

  // Poll while generation_status is 'processing'. Once 'completed', the
  // response also carries total_questions/questions (never
  // correct_answer/explanation); once 'failed', error_message.
  async getQuizStatus(attemptId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.quiz.status(attemptId));
    return data; // { success, data: { attempt_id, attempt_type, generation_status, total_questions?, questions?, error_message? } }
  },

  // Kicks off flashcard generation as a background job — returns
  // immediately with { set_id, generation_status: 'processing' }, NOT
  // the cards themselves; poll getFlashcardSetStatus (or use
  // useGenerationPolling) until generation_status is 'completed' or
  // 'failed'. Now persisted (education_flashcard_sets), unlike before
  // when nothing survived the request/response cycle at all — a set
  // keeps generating even if the student navigates away, and past sets
  // are listed via listFlashcardSets. Distinct study activity from
  // quizzes (active recall via flip-cards, not graded testing).
  // sourceText — set only when converting a note directly into
  // flashcards.
  async generateFlashcards(chapterId, numCards = 8, sourceText = null) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.flashcards.generate, {
      chapter_id: chapterId,
      num_cards: numCards,
      source_text: sourceText,
    });
    return data; // { success, data: { set_id, chapter_id, generation_status } }
  },

  // Poll while generation_status is 'processing'. Once 'completed', the
  // response also carries chapter_name/cards; once 'failed', error_message.
  async getFlashcardSetStatus(setId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.flashcards.status(setId));
    return data; // { success, data: { set_id, chapter_id, generation_status, chapter_name?, cards?, error_message? } }
  },

  // Every flashcard set this student has generated, across every
  // subject, no cap — powers Flashcards.jsx's "Past Sets" section.
  async listFlashcardSets() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.flashcards.sets);
    return data; // { success, data: [{ set_id, chapter_id, chapter_name, subject_id, subject_name, generation_status, error_message, num_cards, created_at }] }
  },

  // Real, rubric-ranked chapter list (see progress_service.js's rubric)
  // plus a short AI-written intro built only from those real numbers.
  async getStudyPlan() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.studyPlan.get);
    return data; // { success, data: { intro, overall_mastery, total_chapters, chapters_completed, items, weekly_plan } }
  },

  // Get-or-create through a shared pool: a chapter+scope this student
  // hasn't seen a generated group for either reuses an unseen one
  // (instant) or triggers a genuinely new generation — this one
  // synchronously (still a real wait, like before), the other 4 in the
  // background. `variant` defaults server-side to 'concept_overview' if
  // omitted. Pass `generationGroupId` (from a prior response, or from
  // MyMindMaps.jsx's "view" link) to reopen that EXACT past generation
  // instead — omitting it always runs the shared-pool "give me an
  // unseen one" logic, which is only correct for a genuinely fresh
  // request, not for revisiting something already seen. The response's
  // generation_group_id must be passed into getMindMapStatus while
  // polling, and identifies this specific generation for "My Mind Maps"
  // purposes.
  async generateMindMap(chapterId, variant, generationGroupId) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.mindmap.generate, {
      chapter_id: chapterId,
      variant,
      generation_group_id: generationGroupId || undefined,
    });
    return data; // { success, data: { chapter_id, chapter_name, variant, generation_group_id, central_topic, branches: [{ label, type, citation, children: [{ label, type, citation, children: [...] }] }], relationships: [...], variants: [{ variant, status }] } }
  },

  // Manifest only (variant/status pairs) — for polling while background
  // variants are still generating, without re-triggering generation.
  // generationGroupId must be the id generateMindMap's response returned
  // — several generated groups can now exist for the same chapter, so a
  // plain chapter_id lookup would be ambiguous.
  async getMindMapStatus(chapterId, generationGroupId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.mindmap.status, {
      params: { chapter_id: chapterId, generation_group_id: generationGroupId },
    });
    return data; // { success, data: { variants: [{ variant, status }] } }
  },

  // Every mind map this student has generated/received, across every
  // subject, no cap — powers MyMindMaps.jsx.
  async listMindMaps() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.mindmap.list);
    return data; // { success, data: [{ generation_group_id, chapter_id, chapter_name, subject_id, subject_name, status, error_message, created_at }] }
  },

  // Get-or-create, always async: the first request for a chapter (per
  // student's board/class scope) creates a "pending" deck and hands
  // generation off to the AI service's background worker immediately —
  // unlike generateMindMap above, there's no synchronous wait here even
  // on the very first request, since Phase 1 has exactly one deck per
  // chapter+scope. status is "processing"/"pending"/"failed" while still
  // generating (poll getSlideDeckStatus), or "completed" with the real
  // deck fields spread in. Pass `slideDeckId` (from a prior response, or
  // from MyLearningDecks.jsx's "view" link) to reopen that EXACT past
  // deck instead — omitting it always runs the shared-pool "give me an
  // unseen one" logic, which is only correct for a genuinely fresh
  // request, not for revisiting something already seen.
  async generateSlideDeck(chapterId, slideDeckId) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.slideDeck.generate, {
      chapter_id: chapterId,
      slide_deck_id: slideDeckId || undefined,
    });
    return data; // { success, data: { chapter_id, chapter_name, status, slide_deck_id, slides: [...] } }
  },

  // Status only — for polling while generation is still running, without
  // re-triggering it. Also the passive path that lets the backend's own
  // stuck-row recovery self-heal a tab that's already open and polling.
  // slideDeckId must be the id generateSlideDeck's response returned —
  // several decks can now exist for the same chapter, so a plain
  // chapter_id lookup would be ambiguous.
  async getSlideDeckStatus(chapterId, slideDeckId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.slideDeck.status, {
      params: { chapter_id: chapterId, slide_deck_id: slideDeckId },
    });
    return data; // { success, data: { status } }
  },

  // Every learning deck this student has generated/received, across
  // every subject, no cap — powers MyLearningDecks.jsx.
  async listSlideDecks() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.slideDeck.list);
    return data; // { success, data: [{ slide_deck_id, chapter_id, chapter_name, subject_id, subject_name, status, error_message, created_at }] }
  },

  // Get-or-create, always async — exact mirror of generateSlideDeck.
  // status is "processing"/"pending"/"failed" while still generating
  // (poll getInfographicStatus), or "completed" with the real
  // chapter_title/big_picture/key_concepts/formulas/definitions/
  // common_mistakes/exam_tips/quick_recap fields spread in.
  async generateInfographic(chapterId) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.infographic.generate, { chapter_id: chapterId });
    return data; // { success, data: { chapter_id, chapter_name, status, ... } }
  },

  // Status only — mirrors getSlideDeckStatus.
  async getInfographicStatus(chapterId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.infographic.status, { params: { chapter_id: chapterId } });
    return data; // { success, data: { status } }
  },

  // Academic Calendar ("My Calendar") — a self-student's own exams/
  // assignments/study/revision events, entirely owner-scoped server-side.
  // start/end are ISO date strings (the visible calendar range); omit
  // eventType/subjectId to get every type/subject.
  async getCalendarEvents(start, end, { eventType, subjectId } = {}) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.myCalendar.events, {
      params: { start, end, event_type: eventType, subject_id: subjectId },
    });
    return data; // { success, data: [{ calendar_event_id, event_type, title, start_datetime, end_datetime, ... }] }
  },

  // Non-exam types only (STUDY/REVISION/ASSIGNMENT/ACADEMIC/REMINDER) —
  // exams go through createExamEvent below, which also links chapters.
  async createCalendarEvent(payload) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.myCalendar.events, payload);
    return data;
  },

  // payload includes chapter_ids: [...] — the backend creates the
  // calendar_event + exam_details + exam_chapters rows together.
  async createExamEvent(payload) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.myCalendar.createExam, payload);
    return data;
  },

  async updateCalendarEvent(eventId, payload) {
    const { data } = await apiClient.patch(EDUCATION_ENDPOINTS.myCalendar.event(eventId), payload);
    return data;
  },

  async deleteCalendarEvent(eventId) {
    const { data } = await apiClient.delete(EDUCATION_ENDPOINTS.myCalendar.event(eventId));
    return data;
  },

  async getUpcomingCalendarEvents(limit) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.myCalendar.upcoming, { params: { limit } });
    return data;
  },

  // Includes a server-computed days_remaining snapshot (see
  // calendar_service.js) — the UI still recomputes it live client-side
  // rather than trusting a value that can go stale between fetches.
  async getUpcomingExams(limit) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.myCalendar.upcomingExams, { params: { limit } });
    return data;
  },

  // Grades one answer server-side immediately. completed=true on the
  // response for the last question means the attempt is now finalized —
  // for a pre_assessment attempt, the backend also seeds a real starting
  // mastery on the chapter's progress row at that point.
  async submitQuizAnswer(attemptId, questionIndex, selectedAnswer) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.quiz.submit(attemptId), {
      question_index: questionIndex,
      selected_answer: selectedAnswer,
    });
    return data; // { success, data: { is_correct, correct_answer, explanation, score, total_questions, completed, percentage } }
  },

  // Past submitted attempts (optionally filtered by 'quiz' | 'mock_test' |
  // 'pre_assessment'), newest first. Pass includeGenerating=true (only
  // pages that actually generate quizzes/mock tests should — Quiz.jsx,
  // MockTests.jsx) to also get back the caller's own in-flight
  // (generation_status 'processing'/'failed') attempts, so a student who
  // navigated away mid-generation can find their way back to it.
  async listQuizAttempts(attemptType, includeGenerating = false) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.quiz.attempts(attemptType, includeGenerating));
    return data; // { success, data: [{ attempt_id, attempt_type, chapter_id, chapter_name, subject_id, subject_name, generation_status, error_message, score, total_questions, percentage, duration_seconds, submitted_at }] }
  },

  // Every real wrong answer, across submitted attempts — the actual
  // question/options/explanation the student was shown, not regenerated.
  async listQuizMistakes({ subjectId, attemptType } = {}) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.quiz.mistakes({ subjectId, attemptType }));
    return data; // { success, data: [{ attempt_id, chapter_name, subject_name, question, options, selected_answer, correct_answer, explanation, submitted_at }] }
  },

  // Real mock-test stats (latest/previous/average score, weakest tested
  // chapter) plus a short AI-written review built only from those numbers.
  async getTestReview() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.quiz.testReview);
    return data; // { success, data: { review, tests_taken, latest_score, previous_score, average_score, weakest_concept } }
  },

  // Rubric-based mastery aggregated from real progress + quiz/mock-test
  // history — see backend progress_service.js for the exact weighting.
  async getProgressOverview() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.progress.overview);
    return data; // { success, data: { overall_mastery, total_chapters, chapters_completed, ..., streak_days, recent_activity } }
  },

  async getSubjectProgress() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.progress.subjects);
    return data; // { success, data: { subjects: [{ subject_id, subject_name, mastery, ... }] } }
  },

  async getAchievements() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.progress.achievements);
    return data; // { success, data: [{ id, title, description, icon, achieved }] }
  },

  // XP/Level/Coins/Missions — all deterministic functions of real
  // activity history, recomputed on every call (see progress_service.js).
  async getGameStats() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.progress.gameStats);
    return data; // { success, data: { xp, level, xp_into_level, xp_for_next_level, coins, missions: [{ id, period, title, progress, target, completed }] } }
  },

  // Pure CRUD, scoped server-side to the caller's own profile.
  async listNotes(chapterId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.notes.list(chapterId));
    return data; // { success, data: [{ note_id, chapter_id, chapter, title, content, tags, created_at, updated_at }] }
  },
  async createNote({ chapterId, title, content, tags }) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.notes.create, { chapter_id: chapterId, title, content, tags });
    return data;
  },
  async updateNote(noteId, { title, content, tags }) {
    const { data } = await apiClient.put(EDUCATION_ENDPOINTS.notes.update(noteId), { title, content, tags });
    return data;
  },
  async deleteNote(noteId) {
    const { data } = await apiClient.delete(EDUCATION_ENDPOINTS.notes.remove(noteId));
    return data;
  },

  // Bookmarks are self-contained snapshots — title/content are copied at
  // creation time, not references back into the chat/quiz they came from.
  async listBookmarks({ chapterId, collection } = {}) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.bookmarks.list({ chapterId, collection }));
    return data; // { success, data: [{ bookmark_id, chapter_id, chapter, source_type, title, content, collection, page_index, created_at }] }
  },
  // pageIndex is only meaningful for sourceType: 'chapter' (the reader's
  // own "bookmark this page" button) — omit for every other source type.
  async createBookmark({ chapterId, sourceType, title, content, collection, pageIndex }) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.bookmarks.create, {
      chapter_id: chapterId,
      source_type: sourceType,
      title,
      content,
      collection,
      page_index: pageIndex,
    });
    return data;
  },
  async updateBookmark(bookmarkId, { collection }) {
    const { data } = await apiClient.put(EDUCATION_ENDPOINTS.bookmarks.update(bookmarkId), { collection });
    return data;
  },
  async deleteBookmark(bookmarkId) {
    const { data } = await apiClient.delete(EDUCATION_ENDPOINTS.bookmarks.remove(bookmarkId));
    return data;
  },

  // Chapter Reader highlights — same self-contained-snapshot pattern as
  // Bookmarks (the highlighted text is copied at creation time, not a
  // live position into the chapter's markdown).
  async listHighlights(chapterId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.highlights.list(chapterId));
    return data; // { success, data: [{ highlight_id, chapter_id, page_index, text, color, created_at }] }
  },
  async createHighlight({ chapterId, pageIndex, text, color }) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.highlights.create, {
      chapter_id: chapterId,
      page_index: pageIndex,
      text,
      color,
    });
    return data;
  },
  async deleteHighlight(highlightId) {
    const { data } = await apiClient.delete(EDUCATION_ENDPOINTS.highlights.remove(highlightId));
    return data;
  },

  // ── Sample Papers (Stage 1 — student paper-taking flow) ────────────────
  // Real teacher-authored exam papers, LLM-graded. model_answer/rubric
  // stay hidden server-side until a response is actually graded — see
  // sample_paper_service.js.

  async listSamplePapers(subjectId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.samplePapers.list(subjectId));
    return data; // { success, data: [{ sample_paper_id, title, subject_id, class_id, paper_type, total_marks, duration_minutes }] }
  },

  async getSamplePaper(samplePaperId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.samplePapers.detail(samplePaperId));
    return data; // { success, data: { sample_paper_id, title, sections, questions: [{ question_id, question_text, question_type, input_type, max_marks, ... }] } }
  },

  async startSamplePaperAttempt(samplePaperId) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.samplePapers.startAttempt(samplePaperId));
    return data; // { success, data: { attempt_id, status, total_marks } }
  },

  // A student writes every answer on paper (organized by question number)
  // and uploads ONE consolidated PDF for the whole attempt — not typed
  // text or a photo per question. Content-Type is explicitly cleared so
  // axios sets the real multipart boundary itself, same override used
  // elsewhere for file uploads.
  async uploadSamplePaperAnswerPdf(attemptId, file) {
    const formData = new FormData();
    formData.append('pdf', file);
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.samplePapers.answerPdf(attemptId), formData, {
      headers: { 'Content-Type': undefined },
    });
    return data; // { success, data: { attempt_id, answer_pdf_key, ... } }
  },

  async submitSamplePaper(attemptId) {
    const { data } = await apiClient.post(EDUCATION_ENDPOINTS.samplePapers.submit(attemptId));
    return data; // { success, data: { attempt_id, status: 'submitted', submitted_at } }
  },

  async getSamplePaperAttempt(attemptId) {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.samplePapers.attempt(attemptId));
    return data; // { success, data: { attempt_id, status, score, percentage, responses: [...] } }
  },

  async listSamplePaperAttempts() {
    const { data } = await apiClient.get(EDUCATION_ENDPOINTS.samplePapers.attempts);
    return data; // { success, data: [{ attempt_id, status, samplePaper: { title, subject_id, paper_type } }] }
  },
};

export default EducationService;