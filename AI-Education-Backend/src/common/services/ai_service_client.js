import axios from "axios";
import FormData from "form-data";

// Thin wrapper around the AI (RAG) service. This is the ONLY place that
// service's URL/shared-secret are used — nothing else in the backend, and
// nothing in the browser, ever talks to the AI service directly.
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8001";
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY;

const client = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: 60000,
  headers: AI_SERVICE_KEY ? { "X-Service-Key": AI_SERVICE_KEY } : {},
});

/**
 * conversation: [{ role: "user"|"assistant", content: string }, ...] —
 * always sourced from ai_messages by the caller, never from local files on
 * the AI service side.
 */
// Long-form asks (e.g. MyNotes' "write clear, well-organized study notes
// for this chapter" prompt) push a full RAG retrieval + generation pass
// well past a plain Q&A turn, and were getting cut off by the shared 60s
// client timeout even though the AI service was still working — given a
// longer timeout here so real generation has room to finish.
// `memory`, if given, must match tutor_engine.py's _build_safe_memory_text
// shape — { relevant_semantic_memories: [{ text, memory_type }], structured:
// { quiz_results, total_score } } — everything else in that dict is
// silently ignored on the FastAPI side, not an error, so an unfamiliar
// shape just fails open (no personalization that turn) rather than
// breaking the chat.
export const chatWithAiTutor = async ({
  question,
  subject,
  chapter,
  mode = "Chat",
  conversation = [],
  board = "CBSE",
  standard = "Standard 9",
  responseMode = "text",
  memory = null,
}) => {
  const { data } = await client.post(
    "/api/tutor/chat",
    {
      question,
      subject,
      chapter,
      mode,
      conversation,
      board,
      standard,
      response_mode: responseMode,
      ...(memory && { memory }),
    },
    { timeout: 180000 }
  );

  return data;
};

/**
 * Image-attach counterpart to chatWithAiTutor, forwarded to FastAPI's
 * POST /api/tutor/chat/image (multipart — the image bytes can't go in a
 * JSON body). Same conversation/board/standard/memory contract as
 * chatWithAiTutor; memory is JSON-stringified since it travels as a form
 * field alongside the file, not as a JSON request body.
 */
export const chatWithAiTutorImage = async ({
  imageBuffer,
  imageFilename,
  question,
  subject,
  chapter,
  mode = "Chat",
  conversation = [],
  board = "CBSE",
  standard = "Standard 9",
  responseMode = "text",
  memory = null,
}) => {
  const form = new FormData();
  form.append("image", imageBuffer, imageFilename);
  form.append("question", question || "");
  form.append("subject", subject);
  form.append("chapter", chapter);
  form.append("mode", mode);
  form.append("conversation", JSON.stringify(conversation));
  form.append("board", board);
  form.append("standard", standard);
  form.append("response_mode", responseMode);
  if (memory) form.append("memory", JSON.stringify(memory));

  const { data } = await client.post("/api/tutor/chat/image", form, {
    headers: form.getHeaders(),
    timeout: 180000, // same generation budget as chatWithAiTutor, plus a local vision read
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return data;
};

/**
 * Hands off a quiz/mock-test/pre-assessment generation to the AI
 * service's Celery worker (core/quiz_tasks.py) — fire-and-acknowledge,
 * same shape as triggerSlideDeckGeneration. Every generation goes through
 * this now, including a chapter's very first attempt; each attempt is a
 * fresh, personalized quiz, not a cached per-chapter resource, so there's
 * no synchronous case to preserve. The actual generation happens after
 * this call returns; its outcome comes back separately via the AI
 * service calling Node's own
 * POST /api/quiz/attempts/:attemptId/callback (see quiz_routes.js). A
 * short timeout here is deliberate — this call only waits for Celery's
 * immediate task-queued acknowledgement, not the generation itself.
 */
export const triggerQuizGeneration = async ({
  attemptId,
  subject,
  chapter,
  numQuestions = 10,
  board = "CBSE",
  standard = "Standard 9",
  focus = null,
  sourceText = null,
}) => {
  const { data } = await client.post(
    "/api/quiz/generate",
    {
      subject,
      chapter,
      num_questions: numQuestions,
      board,
      standard,
      focus,
      source_text: sourceText,
      async_mode: true,
      attempt_id: String(attemptId),
    },
    { timeout: 15000 }
  );
  return data; // { status: "processing", attempt_id }
};

/**
 * Hands off a flashcard set generation to the AI service's Celery
 * worker (core/flashcard_tasks.py) — fire-and-acknowledge, same shape as
 * triggerQuizGeneration. Every generation goes through this now,
 * including a chapter's very first request; each set is a fresh,
 * personalized generation, not a cached per-chapter resource, so
 * there's no synchronous case to preserve. The actual generation
 * happens after this call returns; its outcome comes back separately
 * via the AI service calling Node's own
 * POST /api/flashcards/sets/:setId/callback (see flashcards_routes.js).
 * A short timeout here is deliberate — this call only waits for
 * Celery's immediate task-queued acknowledgement, not the generation
 * itself.
 */
export const triggerFlashcardGeneration = async ({
  setId,
  subject,
  chapter,
  numCards = 8,
  board = "CBSE",
  standard = "Standard 9",
  sourceText = null,
}) => {
  const { data } = await client.post(
    "/api/flashcards/generate",
    {
      subject,
      chapter,
      num_cards: numCards,
      board,
      standard,
      source_text: sourceText,
      async_mode: true,
      set_id: String(setId),
    },
    { timeout: 15000 }
  );
  return data; // { status: "processing", set_id }
};

/**
 * Streams the chapter's real source PDF straight through from the AI
 * service — the Chapter Reader renders the actual PDF in the browser
 * (react-pdf/pdf.js) rather than a transcribed/reformatted version, so
 * there's no generation step here to wait on, just a file transfer.
 * responseType: 'stream' so Node pipes bytes through to the browser as
 * they arrive instead of buffering the whole file in memory first.
 */
export const streamChapterPdf = async ({ subject, chapter }) => {
  return client.get("/api/chapters/pdf", {
    params: { subject, chapter },
    responseType: "stream",
  });
  // returns the full axios response ({ data: <stream>, headers, status })
  // — the caller pipes response.data straight to the Express response.
};

/**
 * Real, general-purpose counterpart to streamChapterPdf above — that one
 * only ever resolves for the hand-seeded Math/Science chapters listed in
 * RAGProductionApp's config/curriculum.py (a static dict predating the
 * real admin ingestion pipeline). Every chapter actually ingested through
 * that pipeline has its real uploaded PDF in MinIO at
 * education_book_ingestions.storage_key — this streams it by that key
 * directly, so any ingested chapter's book can be served, not just the
 * ones hardcoded into that dict.
 */
export const streamChapterPdfByKey = async ({ storageKey }) => {
  return client.get("/api/chapters/pdf-by-key", {
    params: { storage_key: storageKey },
    responseType: "stream",
  });
};

// Same shape as streamChapterPdf, pointed at the real NCERT Solutions/
// Notes PDFs instead of the textbook — mirrors get_ncert_solutions_pdf/
// get_ncert_notes_pdf in RAGProductionApp's main.py. A chapter with no
// NCERT resources yet 404s the same way the textbook route never does —
// callers must treat that as a normal "not available" state.
export const streamNcertSolutionsPdf = async ({ subject, chapter }) => {
  return client.get("/api/chapters/ncert-solutions-pdf", {
    params: { subject, chapter },
    responseType: "stream",
  });
};

export const streamNcertNotesPdf = async ({ subject, chapter }) => {
  return client.get("/api/chapters/ncert-notes-pdf", {
    params: { subject, chapter },
    responseType: "stream",
  });
};

// Plain JSON — {"1.1": {"textbook_pages": [3,5], "questions": [{"number":
// 1, "solution_page": 0}, ...]}, ...} — the structural map that drives
// the contextual "jump to solution" banner and the NCERT Solutions tab's
// Question Index. Cheap on the FastAPI side (pure text extraction, no
// vision/LLM call), so a plain short-timeout GET like getChapterMeta's.
export const getNcertSolutionsIndex = async ({ subject, chapter }) => {
  const { data } = await client.get("/api/chapters/ncert-solutions-index", {
    params: { subject, chapter },
  });
  return data;
};

// Backs the reader's "only show the NCERT Notes/Solutions cards when
// there's actually something there" gating - {has_ncert_solutions,
// has_ncert_notes} booleans, checked cheaply (no PDF bytes transferred).
export const getNcertAvailability = async ({ subject, chapter }) => {
  const { data } = await client.get("/api/chapters/ncert-availability", {
    params: { subject, chapter },
  });
  return data;
};

/**
 * A short (2-3 sentence) motivating intro for the student's study plan,
 * built from real aggregate numbers the caller already computed
 * (overall mastery, weakest chapter, etc.) — the AI only phrases these
 * real facts, it never invents chapter names or numbers of its own.
 * Optional/best-effort: study_plan_service.js falls back to no intro
 * (plan itself still real and useful) if this fails.
 */
export const generateStudyPlanIntro = async ({
  overallMastery,
  totalChapters,
  chaptersCompleted,
  weakestChapter = null,
  weakestMastery = null,
  notStartedCount = 0,
}) => {
  const { data } = await client.post(
    "/api/study-plan/intro",
    {
      overall_mastery: overallMastery,
      total_chapters: totalChapters,
      chapters_completed: chaptersCompleted,
      weakest_chapter: weakestChapter,
      weakest_mastery: weakestMastery,
      not_started_count: notStartedCount,
    },
    { timeout: 30000 }
  );
  return data; // { intro }
};

/**
 * Stateless on the AI service's own side — Node owns persistence for the
 * 5 pre-generated variants (education_mind_maps, see mindmap_service.js's
 * get-or-create flow). This function is always the SYNCHRONOUS call for
 * whichever one variant a student is actively waiting on (today, always
 * "concept_overview" — the only one generated on a chapter's first-ever
 * request); the other 4 variants go through triggerMindMapGeneration
 * below instead.
 *
 * Branches+children plus a relationships call, and — for
 * "concept_overview" only — a bounded third (grandchildren) level, all
 * measured at up to ~50s combined for a real chapter. That's
 * uncomfortably close to the shared 60s client timeout — the same
 * failure mode already hit once for chatWithAiTutor (see its comment
 * above) — so this gets the same longer budget rather than risking "AI
 * service was still working" timeouts under normal load.
 */
export const generateMindMap = async ({ subject, chapter, board = "CBSE", standard = "Standard 9", variant = "concept_overview" }) => {
  const { data } = await client.post(
    "/api/mindmap/generate",
    { subject, chapter, board, standard, variant },
    { timeout: 180000 }
  );
  return data; // { central_topic, branches: [{ label, type, citation, children: [{ label, type, citation, children: [...] }] }], relationships: [{ from_branch_index, to_branch_index, relationship, reason, citation }] }
};

/**
 * Hands off ONE background mind-map variant to the AI service's Celery
 * worker (core/mindmap_tasks.py) — fire-and-acknowledge, same shape as
 * triggerBookIngestion above. The actual generation happens after this
 * call returns; its outcome comes back separately via the AI service
 * calling Node's own POST /api/mindmap/callback/:mindMapId (see
 * mindmap_routes.js). A short timeout here is deliberate — this call
 * only waits for Celery's immediate task-queued acknowledgement, not the
 * generation itself.
 */
export const triggerMindMapGeneration = async ({ mindMapId, subject, chapter, board, standard, variant }) => {
  const { data } = await client.post(
    "/api/mindmap/generate",
    { subject, chapter, board, standard, variant, async_mode: true, mind_map_id: String(mindMapId) },
    { timeout: 15000 }
  );
  return data; // { status: "processing", mind_map_id }
};

/**
 * Hands off an AI Learning Deck generation to the AI service's Celery
 * worker (core/slide_deck_tasks.py) — fire-and-acknowledge, same shape
 * as triggerMindMapGeneration above. Unlike mind maps, there is no
 * synchronous counterpart to this call: Phase 1 ships exactly one deck
 * per chapter+scope, so EVERY generation (including a chapter's very
 * first request) goes through this path — slide_deck_service.js creates
 * a "pending" row and calls this immediately, never blocking a student
 * on the generation itself. The actual generation happens after this
 * call returns; its outcome comes back separately via the AI service
 * calling Node's own POST /api/slide-deck/callback/:slideDeckId (see
 * slide_deck_routes.js). A short timeout here is deliberate — this call
 * only waits for Celery's immediate task-queued acknowledgement.
 */
export const triggerSlideDeckGeneration = async ({ deckId, subject, chapter, board, standard }) => {
  const { data } = await client.post(
    "/api/slide-deck/generate",
    { subject, chapter, board, standard, async_mode: true, deck_id: String(deckId) },
    { timeout: 15000 }
  );
  return data; // { status: "processing", deck_id }
};

/**
 * Hands off an Infographic generation to the AI service's Celery worker
 * (core/infographic_tasks.py) — fire-and-acknowledge, exact same shape
 * as triggerSlideDeckGeneration above. Exactly one infographic per
 * chapter+scope, so every generation goes through this path;
 * infographic_service.js creates a "pending" row and calls this
 * immediately. The actual generation happens after this call returns;
 * its outcome comes back separately via the AI service calling Node's
 * own POST /api/infographic/callback/:infographicId (see
 * infographic_routes.js).
 */
export const triggerInfographicGeneration = async ({ infographicId, subject, chapter, board, standard }) => {
  const { data } = await client.post(
    "/api/infographic/generate",
    { subject, chapter, board, standard, async_mode: true, infographic_id: String(infographicId) },
    { timeout: 15000 }
  );
  return data; // { status: "processing", infographic_id }
};

/**
 * Short (2-3 sentence) real-numbers-only review of a subject's mock test
 * performance — same posture as generateStudyPlanIntro: the caller
 * computes every real stat, the AI only phrases them.
 */
export const generateTestReview = async ({
  latestScore,
  previousScore = null,
  averageScore,
  testsTaken,
  weakestConcept = null,
}) => {
  const { data } = await client.post(
    "/api/test-review/intro",
    {
      latest_score: latestScore,
      previous_score: previousScore,
      average_score: averageScore,
      tests_taken: testsTaken,
      weakest_concept: weakestConcept,
    },
    { timeout: 30000 }
  );
  return data; // { review }
};

/**
 * Hands a chapter PDF off to the AI service for async ingestion (chunk ->
 * embed -> upsert into Qdrant). This only forwards the file and waits for
 * the AI service's immediate acknowledgement that a background job started
 * — the actual multi-minute ingestion work happens after this call returns,
 * and its outcome comes back separately via the AI service calling Node's
 * own POST /api/admin/ingestion/callback/:jobId (see ingestion_routes.js).
 *
 * The first multipart/FormData call in this file — every other function
 * here posts plain JSON.
 */
export const triggerBookIngestion = async ({
  fileBuffer,
  originalFilename,
  board,
  className,
  subject,
  chapter,
  chapterNumber,
  academicYear,
  jobId,
}) => {
  const form = new FormData();
  form.append("file", fileBuffer, originalFilename);
  form.append("job_id", String(jobId));
  if (board) form.append("board", board);
  if (className) form.append("class_name", className);
  if (subject) form.append("subject", subject);
  form.append("chapter", chapter);
  if (chapterNumber !== null && chapterNumber !== undefined) form.append("chapter_number", String(chapterNumber));
  if (academicYear) form.append("academic_year", academicYear);

  const { data } = await client.post("/api/admin/ingest-chapter", form, {
    headers: form.getHeaders(),
    timeout: 30000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return data; // { job_id, status: "processing" }
};

/**
 * Same "acknowledge, then report back via callback" shape as
 * triggerBookIngestion above, but routed through RAGProductionApp's
 * Celery worker (not FastAPI BackgroundTasks) — image ingestion is
 * vision-model + OCR heavy and much longer-running than text chunking,
 * so it benefits from Celery's retry/ack semantics the same way mind
 * map/slide deck generation already do. See
 * core/image_ingestion_tasks.py.
 */
export const triggerImageIngestion = async ({
  fileBuffer,
  originalFilename,
  board,
  className,
  classLevel,
  subject,
  chapter,
  chapterNumber,
  jobId,
  startPage,
}) => {
  const form = new FormData();
  form.append("file", fileBuffer, originalFilename);
  form.append("job_id", String(jobId));
  if (board) form.append("board", board);
  if (className) form.append("class_name", className);
  if (classLevel !== null && classLevel !== undefined) form.append("class_level", String(classLevel));
  if (subject) form.append("subject", subject);
  form.append("chapter", chapter);
  if (chapterNumber !== null && chapterNumber !== undefined) form.append("chapter_number", String(chapterNumber));
  // >1 on a resume call — see ingest_chapter_images_task's own docstring
  // for how this loads that job's on-disk checkpoint instead of
  // reprocessing the document from page 1.
  if (startPage !== null && startPage !== undefined && startPage > 1) form.append("start_page", String(startPage));

  const { data } = await client.post("/api/admin/ingest-chapter-images", form, {
    headers: form.getHeaders(),
    timeout: 30000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return data; // { job_id, status: "processing" }
};

/**
 * Enrichment never takes a PDF — it operates on state a prior
 * triggerImageIngestion call already wrote to MinIO/Qdrant — so this is
 * plain JSON, not multipart, unlike its two siblings above. Also routed
 * through Celery (core/image_enrichment_tasks.py), same reasoning as
 * triggerImageIngestion.
 */
export const triggerImageEnrichment = async ({ subject, chapter, jobId }) => {
  const { data } = await client.post(
    "/api/admin/enrich-chapter-images",
    { subject, chapter, job_id: String(jobId) },
    { timeout: 30000 }
  );

  return data; // { job_id, status: "processing" }
};

// ─── Sample Papers (Stage 0 extraction) ────────────────────────────────
// Same "acknowledge, then report back via callback" shape as
// triggerBookIngestion above, but hands off TWO files (the real Paper PDF
// and its real Solution PDF) — extraction reads both and matches
// questions to their real answers by number (see
// core/sample_paper_extraction.py on the AI-service side).

export const triggerSamplePaperExtraction = async ({
  paperBuffer,
  paperFilename,
  solutionBuffer,
  solutionFilename,
  jobId,
  subject,
  className,
  paperType,
}) => {
  const form = new FormData();
  form.append("paper_file", paperBuffer, paperFilename);
  form.append("solution_file", solutionBuffer, solutionFilename);
  form.append("job_id", String(jobId));
  if (subject) form.append("subject", subject);
  if (className) form.append("class_name", className);
  if (paperType) form.append("paper_type", paperType);

  const { data } = await client.post("/api/admin/sample-papers/extract", form, {
    headers: form.getHeaders(),
    timeout: 30000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return data; // { job_id, status: "processing" }
};

/**
 * Stage 1/2 — hands a student's single consolidated answer PDF off to
 * FastAPI for grading. questions carries the real, authoritative
 * question_text/max_marks/model_answer/rubric_criteria straight from
 * Postgres (mirrors triggerSamplePaperExtraction's hand-off shape) so
 * FastAPI never has to trust anything the student's own upload claims
 * about the paper's content.
 */
export const triggerSamplePaperGrading = async ({ pdfBuffer, pdfFilename, attemptId, questions }) => {
  const form = new FormData();
  form.append("answer_pdf", pdfBuffer, pdfFilename);
  form.append("attempt_id", String(attemptId));
  form.append("questions", JSON.stringify(questions));

  const { data } = await client.post("/api/sample-papers/grade", form, {
    headers: form.getHeaders(),
    timeout: 30000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return data; // { attempt_id, status: "processing" }
};

/**
 * Fallback only — used when a question's extraction couldn't match it to
 * its real Solution entry. Synchronous (a single fast model call, not a
 * multi-minute page-by-page job), unlike triggerSamplePaperExtraction
 * above.
 */
export const draftSamplePaperAnswer = async ({ questionText, maxMarks, subject }) => {
  const { data } = await client.post(
    "/api/admin/sample-papers/draft-answer",
    { question_text: questionText, max_marks: maxMarks, subject },
    { timeout: 180000 } // single retrieval + completion — same budget as chatWithAiTutor
  );
  return data; // { model_answer, rubric_criteria }
};

// ─── Voice (Phase 1 — push-to-talk) ────────────────────────────────────
// Both wrap the AI service's stt_service.py/tts_service.py — zero tutor
// logic here or there; voice_service.js is what calls the existing
// chatWithAiTutor (with responseMode="voice") in between these two.

/**
 * Forwards one recorded utterance to the AI service for transcription.
 * Same multipart/FormData shape as triggerBookIngestion above (the
 * established pattern for sending a binary file to RAGProductionApp) —
 * audioBuffer is whatever multer.memoryStorage() handed voice_routes.js
 * from the browser's MediaRecorder Blob, forwarded as-is with its own
 * mimetype/filename so faster-whisper's decoder sees real container
 * info, not a guess.
 */
export const transcribeAudio = async ({ audioBuffer, filename, mimetype }) => {
  const form = new FormData();
  form.append("audio", audioBuffer, { filename: filename || "utterance.webm", contentType: mimetype });

  const { data } = await client.post("/api/voice/stt", form, {
    headers: form.getHeaders(),
    timeout: 30000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return data; // { text, language, confidence }
};

/**
 * Synthesizes the tutor's already-generated answer text into speech.
 * Plain JSON in, base64-in-JSON out — matches every other AI-service
 * response shape in this file (audio-in is the one exception, since a
 * browser recording is real binary from the start).
 */
export const synthesizeSpeech = async ({ text }) => {
  const { data } = await client.post("/api/voice/tts", { text }, { timeout: 30000 });
  return data; // { audio_base64, format }
};

// Live CPU/GPU utilization for the Ingestion Monitor — see
// core/system_resources.py on the AI service side.
export const getSystemResources = async () => {
  const { data } = await client.get("/api/admin/system-resources", { timeout: 10000 });
  return data;
};

export default {
  chatWithAiTutor,
  chatWithAiTutorImage,
  triggerQuizGeneration,
  triggerFlashcardGeneration,
  streamChapterPdf,
  generateStudyPlanIntro,
  generateMindMap,
  triggerSlideDeckGeneration,
  generateTestReview,
  triggerBookIngestion,
  triggerImageIngestion,
  triggerImageEnrichment,
  getSystemResources,
};
