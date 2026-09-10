import sequelize from "../../../config/database.js";
import { EducationBookIngestion } from "./ingestion_schema.js";
import { EducationChapter } from "../../curriculum/curriculum_schema.js";
import { EducationAcademicSubject, EducationAcademicClass, EducationAcademicBoard } from "../../academic/academic_schema.js";
import User from "../../user/user_schema.js";
import {
  triggerBookIngestion,
  triggerImageIngestion,
  triggerImageEnrichment,
  getSystemResources,
  streamChapterPdfByKey,
} from "../../../common/services/ai_service_client.js";
import {
  pregenerateMindMapService,
  getMindMapAdminStatusService,
  getMindMapStatusForChaptersService,
} from "../../mindmap/mindmap_service.js";
import {
  pregenerateSlideDeckService,
  getSlideDeckAdminStatusService,
  getSlideDeckStatusForChaptersService,
} from "../../slide-deck/slide_deck_service.js";
import {
  pregenerateInfographicService,
  getInfographicAdminStatusService,
  getInfographicStatusForChaptersService,
} from "../../infographic/infographic_service.js";
import { createEducationError } from "../../education_errors.js";

// A chapter's "board" isn't its own column (chapter only has subject_id +
// class_id) — it's resolved transitively via whichever of subject/class
// actually has a board_id set, since either can carry it (see
// academic_schema.js: class rows can be board-agnostic).
const resolveBoardName = (chapter) => chapter.subject?.board?.name || chapter.class?.board?.name || null;

// Numeric grade for image ingestion's DocumentContext.class_no — prefers
// the class's own grade_level (set for real numeric grades), falls back
// to pulling the first number out of its display name ("Class 9" -> 9)
// for a class row that never got grade_level filled in.
const resolveClassLevel = (chapter) => {
  if (chapter.class?.grade_level !== null && chapter.class?.grade_level !== undefined) return chapter.class.grade_level;
  const match = /\d+/.exec(chapter.class?.name || "");
  return match ? Number(match[0]) : null;
};

// Appends one timestamped entry to a job's running log (see
// ingestion_schema.js's `logs` column) — a single atomic SQL UPDATE
// (jsonb `||` concatenation), not a read-modify-write via Sequelize's
// plain .update(). Node's own "handed off to the AI service" write and
// the AI service's own first progress POST for the SAME job can land
// within milliseconds of each other (confirmed live: a read-modify-write
// version dropped the earlier entry when the two raced) — concatenation
// happens inside Postgres itself, so two concurrent appends can never
// clobber one another regardless of request interleaving. Caps at the
// most recent 200 entries so a very long-running job's log can't grow
// unbounded.
const MAX_LOG_ENTRIES = 200;

const appendJobLog = async (job, message) => {
  const entry = JSON.stringify({ at: new Date().toISOString(), message });
  const [[row]] = await sequelize.query(
    `UPDATE education_book_ingestions
     SET logs = (
       CASE WHEN jsonb_array_length(logs) >= :maxEntries
         THEN (logs || :entry::jsonb) - 0
         ELSE logs || :entry::jsonb
       END
     )
     WHERE id = :id
     RETURNING logs`,
    { replacements: { id: job.id, entry: `[${entry}]`, maxEntries: MAX_LOG_ENTRIES } }
  );
  // Keep the in-memory instance in sync so a caller returning this same
  // `job` object straight back in an API response (e.g. the initial
  // "processing started" response) reflects the log entry that was just
  // appended, not a stale snapshot from before this call.
  if (row) job.setDataValue("logs", row.logs);
  return job;
};

const loadChapterWithBoard = async (chapterId) => {
  const chapter = await EducationChapter.findOne({
    where: { chapter_id: chapterId, is_active: true },
    include: [
      { model: EducationAcademicSubject, as: "subject", include: [{ model: EducationAcademicBoard, as: "board" }] },
      { model: EducationAcademicClass, as: "class", include: [{ model: EducationAcademicBoard, as: "board" }] },
    ],
  });
  if (!chapter) throw createEducationError("Chapter not found", 404, "CHAPTER_NOT_FOUND");
  return chapter;
};

export const startIngestionService = async (chapterId, file, userId, { alsoGenerate = null } = {}) => {
  const chapter = await loadChapterWithBoard(chapterId);

  const job = await EducationBookIngestion.create({
    chapter_id: chapter.chapter_id,
    job_type: "text",
    status: "pending",
    source_filename: file.originalname,
    also_generate: alsoGenerate && alsoGenerate.length > 0 ? alsoGenerate : null,
    requested_by: userId || null,
  });
  await appendJobLog(job, `Job created (${file.originalname})`);

  try {
    await triggerBookIngestion({
      fileBuffer: file.buffer,
      originalFilename: file.originalname,
      board: resolveBoardName(chapter),
      className: chapter.class?.name || null,
      subject: chapter.subject?.name || null,
      chapter: chapter.name,
      chapterNumber: chapter.chapter_order,
      academicYear: chapter.academic_year || null,
      jobId: job.id,
    });
    await job.update({ status: "processing" });
    await appendJobLog(job, "Handed off to the AI service — text extraction started");
  } catch (err) {
    // Hand-off to FastAPI itself failed (service unreachable, rejected the
    // request, etc.) — fail the job immediately rather than leaving it
    // stuck at "pending" forever with nothing running to ever update it.
    const message = err.message || "Failed to reach the ingestion service";
    await job.update({ status: "failed", error_message: message });
    await appendJobLog(job, `Failed: ${message}`);
  }

  return job;
};

export const startImageIngestionService = async (chapterId, file, userId) => {
  const chapter = await loadChapterWithBoard(chapterId);

  const job = await EducationBookIngestion.create({
    chapter_id: chapter.chapter_id,
    job_type: "images",
    status: "pending",
    source_filename: file.originalname,
    requested_by: userId || null,
  });
  await appendJobLog(job, `Job created (${file.originalname})`);

  try {
    await triggerImageIngestion({
      fileBuffer: file.buffer,
      originalFilename: file.originalname,
      board: resolveBoardName(chapter),
      className: chapter.class?.name || null,
      classLevel: resolveClassLevel(chapter),
      subject: chapter.subject?.name || null,
      chapter: chapter.name,
      chapterNumber: chapter.chapter_order,
      jobId: job.id,
    });
    await job.update({ status: "processing" });
    await appendJobLog(job, "Handed off to the AI service — image extraction started");
  } catch (err) {
    const message = err.message || "Failed to reach the ingestion service";
    await job.update({ status: "failed", error_message: message });
    await appendJobLog(job, `Failed: ${message}`);
  }

  return job;
};

// Admin asked to interrupt a running 'images' job — the only job_type
// this applies to (it's the only one with a page-by-page checkpoint;
// text/enrich are either fast or don't loop the same way). Doesn't stop
// anything itself: just raises the flag the running Celery task polls
// once per page (see image_ingestion_tasks.py's _check_pause_requested)
// and reports back status: 'paused' on its own once it actually stops.
export const pauseIngestionJobService = async (jobId) => {
  const job = await EducationBookIngestion.findOne({ where: { id: jobId } });
  if (!job) throw createEducationError("Ingestion job not found", 404, "INGESTION_JOB_NOT_FOUND");
  if (job.job_type !== "images") {
    throw createEducationError("Only an in-progress image ingestion job can be paused", 400, "NOT_PAUSABLE");
  }
  if (job.status !== "processing") {
    throw createEducationError(`Cannot pause a job with status '${job.status}'`, 400, "NOT_PROCESSING");
  }
  await job.update({ pause_requested: true });
  return job;
};

// Polled by the running Celery task itself (verifyServiceKey, not admin
// auth — see ingestion_routes.js), once per page. Plain read, no
// side effects — clearing the flag happens when the job's own callback
// actually reports 'paused' (recordIngestionCallbackService) or when a
// resume request re-dispatches it, not here.
export const getPauseStatusService = async (jobId) => {
  const job = await EducationBookIngestion.findOne({ where: { id: jobId } });
  if (!job) throw createEducationError("Ingestion job not found", 404, "INGESTION_JOB_NOT_FOUND");
  return { pause_requested: job.pause_requested };
};

// Re-dispatches a paused 'images' job starting from its last completed
// page + 1. Requires the same PDF file to be re-uploaded — this pipeline
// never persists the original upload anywhere Node can hand back on its
// own (see triggerImageIngestion/ingest_chapter_images_task), so this
// matches how every other re-run of an images job already works today,
// not a new burden introduced by pause/resume specifically. The actual
// skip-already-done-pages behavior lives entirely on the AI-service side
// (its own on-disk checkpoint, keyed by this same job_id) — Node's only
// job here is telling it which page to continue from.
export const resumeIngestionJobService = async (jobId, file, userId) => {
  const job = await EducationBookIngestion.findOne({ where: { id: jobId } });
  if (!job) throw createEducationError("Ingestion job not found", 404, "INGESTION_JOB_NOT_FOUND");
  if (job.job_type !== "images") {
    throw createEducationError("Only an image ingestion job can be resumed", 400, "NOT_RESUMABLE");
  }
  if (job.status !== "paused") {
    throw createEducationError(`Cannot resume a job with status '${job.status}'`, 400, "NOT_PAUSED");
  }
  if (!file) {
    throw createEducationError("A PDF file is required to resume image ingestion", 400, "FILE_REQUIRED");
  }

  const chapter = await loadChapterWithBoard(job.chapter_id);
  const startPage = (job.items_processed || 0) + 1;

  await job.update({ status: "processing", pause_requested: false, source_filename: file.originalname });

  try {
    await triggerImageIngestion({
      fileBuffer: file.buffer,
      originalFilename: file.originalname,
      board: resolveBoardName(chapter),
      className: chapter.class?.name || null,
      classLevel: resolveClassLevel(chapter),
      subject: chapter.subject?.name || null,
      chapter: chapter.name,
      chapterNumber: chapter.chapter_order,
      jobId: job.id,
      startPage,
    });
  } catch (err) {
    await job.update({ status: "failed", error_message: err.message || "Failed to reach the ingestion service" });
  }

  return job;
};

// Text ingestion uploads the PDF to MinIO as its very first step (see
// _run_chapter_ingestion in RAGProductionApp's main.py) — well before the
// chunk/embed/index work that's actually likely to fail — and now reports
// that storage_key back on failure too, not just success. So a failed
// text job usually still has its original PDF sitting in MinIO; this
// fetches it back as a Buffer so retry can reuse it instead of asking the
// admin to re-pick the file. Images has no equivalent: nothing in that
// pipeline persists the raw PDF anywhere retrievable, so it always needs
// a fresh upload.
const fetchStoredPdfBuffer = async (storageKey) => {
  const response = await streamChapterPdfByKey({ storageKey });
  const chunks = [];
  for await (const chunk of response.data) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

// Admin-triggered restart for a job that's stuck — 'failed' (a real
// error) or 'pending' (e.g. Node restarted mid-hand-off and nothing is
// ever going to move it out of pending on its own). Unlike resume, this
// isn't limited to 'images'/'paused' — any job_type can end up in either
// state. text can usually skip the re-upload entirely (see
// fetchStoredPdfBuffer — the PDF normally already sits in MinIO from the
// original attempt); images always needs it re-uploaded (no equivalent
// backup exists for that pipeline), continuing from its last processed
// page rather than starting over, same reasoning as resume. enrich needs
// no file and just re-dispatches the same row.
export const retryIngestionJobService = async (jobId, file, userId) => {
  const job = await EducationBookIngestion.findOne({ where: { id: jobId } });
  if (!job) throw createEducationError("Ingestion job not found", 404, "INGESTION_JOB_NOT_FOUND");
  if (!["failed", "pending"].includes(job.status)) {
    throw createEducationError(`Cannot retry a job with status '${job.status}'`, 400, "NOT_RETRYABLE");
  }

  const chapter = await loadChapterWithBoard(job.chapter_id);

  if (job.job_type === "text") {
    let fileBuffer;
    let originalFilename;
    if (file) {
      fileBuffer = file.buffer;
      originalFilename = file.originalname;
    } else if (job.storage_key) {
      try {
        fileBuffer = await fetchStoredPdfBuffer(job.storage_key);
      } catch (err) {
        throw createEducationError(
          "Couldn't fetch the previously uploaded PDF — please re-upload it",
          502,
          "STORED_PDF_UNAVAILABLE"
        );
      }
      originalFilename = job.source_filename || "chapter.pdf";
    } else {
      throw createEducationError("A PDF file is required to retry text ingestion", 400, "FILE_REQUIRED");
    }

    await job.update({ status: "processing", error_message: null, source_filename: originalFilename });
    await appendJobLog(job, file ? `Retrying (${originalFilename})` : `Retrying (reusing previously uploaded PDF)`);
    try {
      await triggerBookIngestion({
        fileBuffer,
        originalFilename,
        board: resolveBoardName(chapter),
        className: chapter.class?.name || null,
        subject: chapter.subject?.name || null,
        chapter: chapter.name,
        chapterNumber: chapter.chapter_order,
        academicYear: chapter.academic_year || null,
        jobId: job.id,
      });
      await appendJobLog(job, "Handed off to the AI service — text extraction started");
    } catch (err) {
      const message = err.message || "Failed to reach the ingestion service";
      await job.update({ status: "failed", error_message: message });
      await appendJobLog(job, `Failed: ${message}`);
    }
    return job;
  }

  if (job.job_type === "images") {
    if (!file) throw createEducationError("A PDF file is required to retry image ingestion", 400, "FILE_REQUIRED");
    const startPage = (job.items_processed || 0) + 1;
    await job.update({ status: "processing", error_message: null, pause_requested: false, source_filename: file.originalname });
    await appendJobLog(job, `Retrying from page ${startPage} (${file.originalname})`);
    try {
      await triggerImageIngestion({
        fileBuffer: file.buffer,
        originalFilename: file.originalname,
        board: resolveBoardName(chapter),
        className: chapter.class?.name || null,
        classLevel: resolveClassLevel(chapter),
        subject: chapter.subject?.name || null,
        chapter: chapter.name,
        chapterNumber: chapter.chapter_order,
        jobId: job.id,
        startPage,
      });
      await appendJobLog(job, "Handed off to the AI service — image extraction resumed");
    } catch (err) {
      const message = err.message || "Failed to reach the ingestion service";
      await job.update({ status: "failed", error_message: message });
      await appendJobLog(job, `Failed: ${message}`);
    }
    return job;
  }

  if (job.job_type === "enrich") {
    const latestCompletedImages = await EducationBookIngestion.findOne({
      where: { chapter_id: chapter.chapter_id, job_type: "images", status: "completed" },
      order: [["created_at", "DESC"]],
    });
    if (!latestCompletedImages) {
      throw createEducationError(
        "This chapter's images haven't completed yet — retry images before enrichment",
        400,
        "IMAGES_NOT_INGESTED"
      );
    }
    await job.update({ status: "processing", error_message: null, waits_for_job_id: null });
    await appendJobLog(job, "Retrying");
    await dispatchEnrichmentJob(job, chapter);
    return job;
  }

  throw createEducationError(`Unknown job type '${job.job_type}'`, 400, "UNKNOWN_JOB_TYPE");
};

// Actually hands an 'enrich' job off to FastAPI now — called either
// immediately (images already completed for this chapter) or later, from
// recordIngestionCallbackService, once the images job it was waiting on
// completes.
const dispatchEnrichmentJob = async (job, chapter) => {
  try {
    await triggerImageEnrichment({
      subject: chapter.subject?.name || null,
      chapter: chapter.name,
      jobId: job.id,
    });
    await job.update({ status: "processing" });
    await appendJobLog(job, "Handed off to the AI service — enrichment started");
  } catch (err) {
    const message = err.message || "Failed to reach the ingestion service";
    await job.update({ status: "failed", error_message: message });
    await appendJobLog(job, `Failed: ${message}`);
  }
};

export const startEnrichmentService = async (chapterId, userId) => {
  const chapter = await loadChapterWithBoard(chapterId);

  const latestCompletedImages = await EducationBookIngestion.findOne({
    where: { chapter_id: chapter.chapter_id, job_type: "images", status: "completed" },
    order: [["created_at", "DESC"]],
  });

  const job = await EducationBookIngestion.create({
    chapter_id: chapter.chapter_id,
    job_type: "enrich",
    status: "pending",
    requested_by: userId || null,
  });
  await appendJobLog(job, "Job created");

  if (latestCompletedImages) {
    await dispatchEnrichmentJob(job, chapter);
  }
  // else: stays 'pending' with no waits_for_job_id — the caller
  // (processChapterService) is responsible for either wiring
  // waits_for_job_id to a freshly-created 'images' job in the same
  // request, or rejecting the request if images was never requested and
  // nothing already completed (see below).

  return job;
};

// The single entrypoint the new /process route calls. Expands the
// admin's requested steps to include their implicit prerequisites
// (enrich -> also images; mindmap/slidedeck -> also text) rather than
// erroring — the user asked for this to chain automatically, not to be
// told what order to click things in.
export const processChapterService = async (chapterId, file, steps, userId, { force = false } = {}) => {
  const requested = new Set(Array.isArray(steps) ? steps : []);
  if (requested.size === 0) {
    throw createEducationError("At least one processing step is required", 400, "STEPS_REQUIRED");
  }

  const wantsText = requested.has("text");
  const wantsImages = requested.has("images");
  const wantsEnrich = requested.has("enrich");
  const wantsMindMap = requested.has("mindmap");
  const wantsSlideDeck = requested.has("slidedeck");
  const wantsInfographic = requested.has("infographic");

  // text/images both need the real PDF bytes; enrich/mindmap/slidedeck/
  // infographic operate on already-ingested state and never touch the upload.
  if ((wantsText || wantsImages) && !file) {
    throw createEducationError("A PDF file is required for text/image ingestion", 400, "FILE_REQUIRED");
  }

  const chapter = await loadChapterWithBoard(chapterId);
  const result = {};

  const alsoGenerate = [];
  if (wantsMindMap) alsoGenerate.push("mindmap");
  if (wantsSlideDeck) alsoGenerate.push("slidedeck");
  if (wantsInfographic) alsoGenerate.push("infographic");

  if (wantsText) {
    result.text = await startIngestionService(chapterId, file, userId, { alsoGenerate });
  } else if (wantsMindMap || wantsSlideDeck || wantsInfographic) {
    // Piggyback the request onto whatever's the most recent text job —
    // if it's still in flight, its own callback fires these once it
    // lands; if it's already completed, fire them right now instead of
    // waiting on a callback that already happened.
    const latestText = await EducationBookIngestion.findOne({
      where: { chapter_id: chapter.chapter_id, job_type: "text" },
      order: [["created_at", "DESC"]],
    });
    if (!latestText || latestText.status === "failed") {
      throw createEducationError(
        "This chapter's text hasn't been ingested yet — ingest text before generating a mind map, slide deck, or infographic",
        400,
        "TEXT_NOT_INGESTED"
      );
    }
    if (latestText.status === "completed") {
      if (wantsMindMap) result.mindmap = await pregenerateMindMapService(chapterId, { force });
      if (wantsSlideDeck) result.slidedeck = await pregenerateSlideDeckService(chapterId, { force });
      if (wantsInfographic) result.infographic = await pregenerateInfographicService(chapterId, { force });
    } else {
      // Still pending/processing — attach our ask to it so its own
      // completion callback fires these, mirroring what startIngestionService
      // would have done had we created a fresh text job instead.
      const existing = Array.isArray(latestText.also_generate) ? latestText.also_generate : [];
      await latestText.update({ also_generate: [...new Set([...existing, ...alsoGenerate])] });
      result.text = latestText;
    }
  }

  if (wantsImages) {
    result.images = await startImageIngestionService(chapterId, file, userId);
  }

  if (wantsEnrich) {
    const enrichJob = await startEnrichmentService(chapterId, userId);
    if (enrichJob.status === "pending" && result.images) {
      // Images was requested in this same batch and hasn't completed
      // yet (it was just created above) — chain enrich to fire once
      // that job's callback reports completed.
      await enrichJob.update({ waits_for_job_id: result.images.id });
    } else if (enrichJob.status === "pending" && !result.images) {
      // Enrich was requested alone with nothing already ingested for
      // this chapter — a real precondition failure, not something to
      // silently wait on forever.
      await enrichJob.destroy();
      throw createEducationError(
        "This chapter's images haven't been ingested yet — ingest images before enrichment can run",
        400,
        "IMAGES_NOT_INGESTED"
      );
    }
    result.enrich = enrichJob;
  }

  return result;
};

export const recordIngestionCallbackService = async (jobId, { status, chunks_ingested, items_processed, storage_key, error_message }) => {
  const job = await EducationBookIngestion.findOne({ where: { id: jobId } });
  if (!job) throw createEducationError("Ingestion job not found", 404, "INGESTION_JOB_NOT_FOUND");

  await job.update({
    status,
    ...(chunks_ingested !== undefined && { chunks_ingested }),
    ...(items_processed !== undefined && { items_processed }),
    ...(storage_key !== undefined && { storage_key }),
    ...(error_message !== undefined && { error_message }),
    // A terminal status makes current_stage/total_items stale
    // immediately — nothing will ever update them again for this row.
    // Also: items_processed means something different at each end of a
    // job's life (e.g. for images, "pages done" while processing vs.
    // "visuals stored" once complete — see image_ingestion_tasks.py's
    // _on_page vs. its final _post_callback) — clearing total_items on
    // completion means the UI shows the final count plainly instead of
    // implying it's out of the in-progress page total, which would read
    // as the count having gone backward.
    ...(["completed", "failed"].includes(status) && { current_stage: null, total_items: null }),
  });

  if (status === "completed") {
    await appendJobLog(job, `Completed${items_processed != null ? ` (${items_processed} item${items_processed === 1 ? "" : "s"})` : ""}`);
  } else if (status === "failed") {
    await appendJobLog(job, `Failed: ${error_message || "unknown error"}`);
  } else if (status === "paused") {
    await appendJobLog(job, `Paused at item ${items_processed ?? "?"}`);
  }

  if (status === "completed") {
    // Both branches below are deliberately NOT awaited — this callback
    // is itself a POST from RAGProductionApp with only a 10s client-side
    // timeout (see _post_ingestion_callback), and mind map generation's
    // synchronous default-variant call alone can legitimately take up to
    // ~180s under load (see mindmap_service.js's own stuck-row comment).
    // Blocking the callback response on that would blow past FastAPI's
    // timeout for no reason — the DB update above already happened, so
    // the response can return immediately while chaining continues
    // in the background. Errors are swallowed here on purpose: each
    // callee already marks its own row 'failed' on a real error, so
    // there's nothing more useful to do with the rejection here than
    // log it.

    // Chain any job that was waiting specifically on this one (today,
    // only 'enrich' waits on 'images' — generic by design so a future
    // dependent step type doesn't need new plumbing here).
    EducationBookIngestion.findOne({ where: { waits_for_job_id: job.id, status: "pending" } })
      .then(async (dependent) => {
        if (!dependent) return;
        const chapter = await loadChapterWithBoard(job.chapter_id);
        await dispatchEnrichmentJob(dependent, chapter);
      })
      .catch((err) => console.error(`[ingestion] failed to chain dependent job for ${job.id}:`, err.message));

    // A 'text' job that also asked for mind map / slide deck generation
    // fires them now that ingestion has actually landed.
    if (job.job_type === "text" && Array.isArray(job.also_generate) && job.also_generate.length > 0) {
      if (job.also_generate.includes("mindmap")) {
        pregenerateMindMapService(job.chapter_id).catch((err) =>
          console.error(`[ingestion] pregenerateMindMapService failed for chapter ${job.chapter_id}:`, err.message)
        );
      }
      if (job.also_generate.includes("slidedeck")) {
        pregenerateSlideDeckService(job.chapter_id).catch((err) =>
          console.error(`[ingestion] pregenerateSlideDeckService failed for chapter ${job.chapter_id}:`, err.message)
        );
      }
      if (job.also_generate.includes("infographic")) {
        pregenerateInfographicService(job.chapter_id).catch((err) =>
          console.error(`[ingestion] pregenerateInfographicService failed for chapter ${job.chapter_id}:`, err.message)
        );
      }
    }
  }

  return job;
};

// Interim progress reports while a job is still 'processing' — separate
// from recordIngestionCallbackService above, which only ever fires once,
// at the very end. Called from image_ingestion_tasks.py after every page
// (via process_pdf's own on_page hook) and from image_enrichment_tasks.py
// at each pipeline stage transition. Deliberately doesn't touch `status`
// — a progress report can arrive after the job has already reached a
// terminal state in a rare race (e.g. a slow in-flight POST landing just
// after the final callback), and overwriting a real "completed"/"failed"
// back to implicitly-processing would be wrong; those fields are simply
// stale at that point and the next read after completion ignores them
// anyway (the admin UI only displays current_stage while status is
// 'processing').
export const recordIngestionProgressService = async (jobId, { current_stage, items_processed, total_items }) => {
  const job = await EducationBookIngestion.findOne({ where: { id: jobId } });
  if (!job) throw createEducationError("Ingestion job not found", 404, "INGESTION_JOB_NOT_FOUND");

  await job.update({
    ...(current_stage !== undefined && { current_stage }),
    ...(items_processed !== undefined && { items_processed }),
    ...(total_items !== undefined && { total_items }),
  });

  if (current_stage !== undefined) {
    const suffix = items_processed != null && total_items != null ? ` (${items_processed}/${total_items})` : "";
    await appendJobLog(job, `${current_stage}${suffix}`);
  }

  return job;
};

// Mind map / slide deck / infographic never got a job_type row in this
// table — they already track their own status via EducationMindMap/
// EducationSlideDeck/EducationInfographic (see the also_generate
// mechanism above). This is the one place the admin curriculum screen
// reads all three at once, alongside listIngestionJobsService's
// text/images/enrich rows, to build one combined "what's happening for
// this chapter" view. Each lookup is independently caught — a chapter
// that was never processed at all (no rows anywhere) is a completely
// normal state, not an error, and one lookup failing shouldn't blank out
// the other two.
export const getGenerationStatusService = async (chapterId) => {
  const [mindmap, slidedeck, infographic] = await Promise.all([
    getMindMapAdminStatusService(chapterId).catch(() => ({ variants: [] })),
    getSlideDeckAdminStatusService(chapterId).catch(() => ({ status: null })),
    getInfographicAdminStatusService(chapterId).catch(() => ({ status: null })),
  ]);
  return { mindmap, slidedeck, infographic };
};

// Backs the Ingestion Monitor's default view — one row per chapter
// instead of one row per job attempt. The old flat job-by-job list (see
// listIngestionJobsService below, kept as-is for the "view raw job
// history" drill-down) buries the actual question an admin has — "what
// does THIS chapter still need" — under every historical retry attempt
// scattered across timestamps, with the Retry/Pause/Resume actions
// hidden behind a per-row expand toggle nobody found. This collapses
// text/images/enrich to their latest attempt per chapter (mirroring what
// CurriculumList's own status pills already do) and folds in
// mindmap/slide deck/infographic — which never had a job_type row here at
// all — via the bulk status lookups above, all in a bounded number of
// queries regardless of how many chapters exist.
//
// Only chapters with at least one job or generation row anywhere are
// included — a chapter nobody has ever tried to process is a normal,
// expected state (handled by CurriculumList's own "Process Chapter"
// entrypoint), not something this "what's broken and needs fixing"
// screen needs to list.
export const getChapterProcessingOverviewService = async (subjectId = null) => {
  const chapterWhere = subjectId ? { subject_id: subjectId } : undefined;

  const jobs = await EducationBookIngestion.findAll({
    include: [
      {
        model: EducationChapter,
        as: "chapter",
        attributes: ["chapter_id", "name", "chapter_order", "subject_id", "class_id", "academic_year"],
        where: chapterWhere,
        required: true,
        include: [
          { model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] },
          { model: EducationAcademicClass, as: "class", attributes: ["class_id", "name"] },
        ],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  // Latest job per (chapter_id, job_type) — jobs are already DESC by
  // created_at, so the first one seen for a key is the latest.
  const latestByChapterAndType = new Map();
  const chaptersById = new Map();
  for (const job of jobs) {
    const key = `${job.chapter_id}:${job.job_type}`;
    if (!latestByChapterAndType.has(key)) latestByChapterAndType.set(key, job);
    if (!chaptersById.has(job.chapter_id)) chaptersById.set(job.chapter_id, job.chapter);
  }

  const chapterIds = [...chaptersById.keys()];
  const [mindmapByChapter, slidedeckByChapter, infographicByChapter] = await Promise.all([
    getMindMapStatusForChaptersService(chapterIds),
    getSlideDeckStatusForChaptersService(chapterIds),
    getInfographicStatusForChaptersService(chapterIds),
  ]);

  const toStageSummary = (job) =>
    job && {
      jobId: job.id,
      status: job.status,
      updatedAt: job.updated_at,
      errorMessage: job.error_message,
      itemsProcessed: job.items_processed,
      totalItems: job.total_items,
      hasStorageKey: Boolean(job.storage_key),
    };

  const NEEDS_ATTENTION_STATUSES = new Set(["failed", "pending"]);

  return chapterIds
    .map((chapterId) => {
      const chapter = chaptersById.get(chapterId);
      const text = toStageSummary(latestByChapterAndType.get(`${chapterId}:text`));
      const images = toStageSummary(latestByChapterAndType.get(`${chapterId}:images`));
      const enrich = toStageSummary(latestByChapterAndType.get(`${chapterId}:enrich`));
      const mindmap = mindmapByChapter[chapterId] || { status: null };
      const slidedeck = slidedeckByChapter[chapterId] || { status: null };
      const infographic = infographicByChapter[chapterId] || { status: null };

      const stageStatuses = [text?.status, images?.status, enrich?.status, mindmap.status, slidedeck.status, infographic.status];
      const needsAttention = stageStatuses.some((s) => NEEDS_ATTENTION_STATUSES.has(s));

      return {
        chapter_id: chapterId,
        chapter_name: chapter.name,
        chapter_order: chapter.chapter_order,
        academic_year: chapter.academic_year,
        subject_name: chapter.subject?.name || null,
        class_name: chapter.class?.name || null,
        needsAttention,
        stages: { text, images, enrich, mindmap, slidedeck, infographic },
      };
    })
    .sort((a, b) => {
      if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
      return (a.subject_name || "").localeCompare(b.subject_name || "") || (a.chapter_order || 0) - (b.chapter_order || 0);
    });
};

// Backs the Ingestion Monitor's "view raw job history" drill-down — every
// job across every chapter/subject
// (not collapsed to "latest per type" the way the chapter table's status
// pills are), with enough joined context (chapter/subject/class name, who
// requested it) that the monitor never needs a second round-trip per row.
export const listIngestionJobsService = async (chapterId = null, subjectId = null) => {
  const where = {};
  if (chapterId) where.chapter_id = chapterId;

  const chapterWhere = subjectId ? { subject_id: subjectId } : undefined;

  return EducationBookIngestion.findAll({
    where,
    include: [
      {
        model: EducationChapter,
        as: "chapter",
        attributes: ["chapter_id", "name", "chapter_order", "subject_id", "class_id"],
        where: chapterWhere,
        required: Boolean(subjectId),
        include: [
          { model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] },
          { model: EducationAcademicClass, as: "class", attributes: ["class_id", "name"] },
        ],
      },
      { model: User, as: "requestedByUser", attributes: ["user_id", "first_name", "last_name", "account_email"] },
    ],
    order: [["created_at", "DESC"]],
  });
};

export const getIngestionJobService = async (jobId) => {
  const job = await EducationBookIngestion.findOne({ where: { id: jobId } });
  if (!job) throw createEducationError("Ingestion job not found", 404, "INGESTION_JOB_NOT_FOUND");
  return job;
};

// Live CPU/GPU utilization from the AI service's own machine — the
// Ingestion Monitor's "is this actually working right now" panel. Never
// throws past the caller on an unreachable/erroring AI service; a
// monitoring panel failing to load must never break the rest of the
// admin screen.
export const getSystemResourcesService = async () => {
  try {
    return await getSystemResources();
  } catch (err) {
    throw createEducationError(
      err.message || "Failed to reach the AI service for system resources",
      503,
      "SYSTEM_RESOURCES_UNAVAILABLE"
    );
  }
};
