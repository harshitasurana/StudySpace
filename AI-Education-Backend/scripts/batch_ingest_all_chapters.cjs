// Batch-processes images/enrich/mindmap(all 5 variants)/slidedeck/infographic
// for all 21 real Class 9 Math+Science chapters, using the real local source
// PDFs in RAGProductionApp/knowledge_base/. Text is intentionally skipped —
// it's already correctly embedded in the office Qdrant (verified separately)
// and a matching education_book_ingestions "completed" row was backfilled so
// the mindmap/slidedeck/infographic gate is satisfied without re-ingesting
// (re-ingesting text has no dedup and would create duplicate Qdrant points).
//
// One-off ops script — not part of the app, safe to delete once the batch
// has run successfully.
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

const BASE = "http://localhost:4000/api";
const TOKEN = process.env.BATCH_TOKEN;
if (!TOKEN) {
  console.error("Set BATCH_TOKEN env var to a fresh super_admin JWT");
  process.exit(1);
}

const client = axios.create({
  baseURL: BASE,
  headers: { Authorization: `Bearer ${TOKEN}` },
  timeout: 15 * 60 * 1000,
});

const KB = "C:/Users/jgung/PycharmProjects/Education/RAGProductionApp/knowledge_base";

// Math 1-8 and Science 1/10/11 were already restored via
// scripts/rebuild_textbook_images_from_minio.py (real prior extraction
// data existed in MinIO for those 11) — this run only covers the 10
// chapters that had no prior data at all and genuinely need the real
// extraction pipeline.
const mathChapters = [];
const scienceChapters = [2, 3, 4, 5, 6, 7, 8, 9, 12, 13].map((n) => ({
  chapterId: 8 + n,
  file: path.join(KB, "Science", `science_chapter${n}.pdf`),
  label: `Science ch${n}`,
}));
const chapters = [...mathChapters, ...scienceChapters];

const LOG_FILE =
  "C:/Users/jgung/AppData/Local/Temp/claude/c--Users-jgung-PycharmProjects-Education/73105e09-5acb-4f34-b824-7bfd97880cc7/scratchpad/batch_ingest_progress.log";
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function processStep(chapterId, steps, filePath) {
  const form = new FormData();
  form.append("steps", JSON.stringify(steps));
  if (filePath) form.append("file", fs.createReadStream(filePath));
  const res = await client.post(
    `/admin/ingestion/chapters/${chapterId}/process`,
    form,
    { headers: form.getHeaders() }
  );
  return res.data;
}

async function latestJob(chapterId, jobType) {
  const res = await client.get(`/admin/ingestion`, { params: { chapter_id: chapterId } });
  const jobs = res.data.data || [];
  return jobs
    .filter((j) => j.job_type === jobType)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

async function pollUntilDone(chapterId, jobType, maxWaitMs, pollEveryMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const job = await latestJob(chapterId, jobType);
    if (job && (job.status === "completed" || job.status === "failed")) return job;
    await sleep(pollEveryMs);
  }
  throw new Error(`timeout waiting for ${jobType} on chapter ${chapterId}`);
}

// Idempotent: if a completed (or currently in-flight) job of this type
// already exists for the chapter, wait on/reuse it instead of submitting
// a redundant duplicate — lets this script be safely re-run/resumed.
async function ensureStep(chapterId, jobType, steps, filePath, maxWaitMs) {
  const existing = await latestJob(chapterId, jobType);
  if (existing && existing.status === "completed") {
    log(`${jobType} already completed (job ${existing.id}) — skipping`);
    return existing;
  }
  if (existing && existing.status === "processing") {
    log(`${jobType} already in progress (job ${existing.id}) — waiting on it instead of resubmitting`);
    return pollUntilDone(chapterId, jobType, maxWaitMs);
  }
  await processStep(chapterId, steps, filePath);
  return pollUntilDone(chapterId, jobType, maxWaitMs);
}

async function main() {
  log(`=== BATCH START: ${chapters.length} chapters ===`);
  const summary = [];

  for (const { chapterId, file, label } of chapters) {
    log(`\n### Chapter ${chapterId} (${label}) — file: ${path.basename(file)} ###`);
    if (!fs.existsSync(file)) {
      log(`SKIP — source file not found: ${file}`);
      summary.push({ chapterId, label, error: "source file missing" });
      continue;
    }

    const result = { chapterId, label };

    try {
      log("ensuring images...");
      const imagesJob = await ensureStep(chapterId, "images", ["images"], file, 10 * 60 * 1000);
      result.images = imagesJob.status;
      log(`images -> ${imagesJob.status}`);
    } catch (e) {
      result.images = "error";
      log(`images FAILED: ${e.message}`);
    }

    try {
      log("ensuring enrich...");
      const enrichJob = await ensureStep(chapterId, "enrich", ["enrich"], null, 10 * 60 * 1000);
      result.enrich = enrichJob.status;
      log(`enrich -> ${enrichJob.status}`);
    } catch (e) {
      result.enrich = "error";
      log(`enrich FAILED: ${e.message}`);
    }

    try {
      log("submitting mindmap (all 5 variants; request awaits default variant)...");
      const mmRes = await processStep(chapterId, ["mindmap"], null);
      result.mindmap = mmRes?.data?.mindmap?.variants || mmRes?.data?.mindmap;
      log(`mindmap -> ${JSON.stringify(result.mindmap)}`);
    } catch (e) {
      result.mindmap = "error";
      log(`mindmap FAILED: ${e.message}`);
    }

    try {
      log("submitting slidedeck...");
      const sdRes = await processStep(chapterId, ["slidedeck"], null);
      result.slidedeck = sdRes?.data?.slidedeck?.status || sdRes?.data?.slidedeck;
      log(`slidedeck -> ${JSON.stringify(result.slidedeck)}`);
    } catch (e) {
      result.slidedeck = "error";
      log(`slidedeck FAILED: ${e.message}`);
    }

    try {
      log("submitting infographic...");
      const igRes = await processStep(chapterId, ["infographic"], null);
      result.infographic = igRes?.data?.infographic?.status || igRes?.data?.infographic;
      log(`infographic -> ${JSON.stringify(result.infographic)}`);
    } catch (e) {
      result.infographic = "error";
      log(`infographic FAILED: ${e.message}`);
    }

    summary.push(result);
    log(`### Chapter ${chapterId} (${label}) DONE ###`);
  }

  log("\n=== BATCH COMPLETE ===");
  log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  log(`FATAL: ${e.stack || e.message}`);
  process.exit(1);
});
