// One-off: resumes the 4 chapters left in a phantom "processing" state
// after today's Celery queue purge (their backing tasks were destroyed
// mid-flight, never reported failure). Their images jobs were already
// corrected to 'failed' via fix_stuck_images.cjs; this retries them with
// the matching PDF, then force-retries mind map/slide deck/infographic
// for the same chapters (force bypasses the stuck-row cooldown, since an
// admin explicitly asking for this should never silently no-op).
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

const BASE = "http://localhost:4000/api";
const TOKEN = fs
  .readFileSync(
    "C:/Users/jgung/AppData/Local/Temp/claude/c--Users-jgung-PycharmProjects-Education/73105e09-5acb-4f34-b824-7bfd97880cc7/scratchpad/batch_token.txt",
    "utf8"
  )
  .trim();

const client = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${TOKEN}` }, timeout: 5 * 60 * 1000 });

const PDF_DIR = "C:/Users/jgung/Downloads/_cleaned_for_ingestion";
const pdfFiles = fs.readdirSync(PDF_DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
const findPdfFor = (chapterName) => {
  const needle = chapterName.trim().toLowerCase();
  const match = pdfFiles.find((f) => f.toLowerCase().includes(needle));
  return match ? path.join(PDF_DIR, match) : null;
};

const LOG_FILE =
  "C:/Users/jgung/AppData/Local/Temp/claude/c--Users-jgung-PycharmProjects-Education/73105e09-5acb-4f34-b824-7bfd97880cc7/scratchpad/resume_after_purge.log";
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHAPTERS = [
  { chapterId: 53, name: "Bharat Our Land", imagesJobId: 212, stages: ["mindmap", "slidedeck", "infographic"] },
  { chapterId: 60, name: "Believe in Yourself", imagesJobId: 221, stages: ["mindmap", "slidedeck", "infographic"] },
  { chapterId: 47, name: "Early Humans and Beginning of Civilisation", imagesJobId: 139, stages: ["mindmap"] },
  { chapterId: 48, name: "State and Society up to 1000 CE", imagesJobId: 142, stages: ["mindmap"] },
];

async function retryImages(jobId, pdf) {
  const form = new FormData();
  form.append("file", fs.createReadStream(pdf));
  return client.post(`/admin/ingestion/${jobId}/retry`, form, { headers: form.getHeaders() });
}

async function retryGeneration(chapterId, stageKey) {
  const form = new FormData();
  form.append("steps", JSON.stringify([stageKey]));
  return client.post(`/admin/ingestion/chapters/${chapterId}/process`, form, { headers: form.getHeaders() });
}

async function main() {
  log("=== RESUME AFTER PURGE START ===");
  for (const ch of CHAPTERS) {
    log(`\n### ${ch.name} (chapter_id=${ch.chapterId}) ###`);

    const pdf = findPdfFor(ch.name);
    if (!pdf) {
      log(`images SKIPPED — no matching PDF found for "${ch.name}"`);
    } else {
      try {
        await retryImages(ch.imagesJobId, pdf);
        log(`images -> retried (uploaded ${path.basename(pdf)})`);
      } catch (e) {
        log(`images FAILED: ${e.response?.data?.message || e.message}`);
      }
      await sleep(8000);
    }

    for (const stageKey of ch.stages) {
      try {
        await retryGeneration(ch.chapterId, stageKey);
        log(`${stageKey} -> retried (forced)`);
      } catch (e) {
        log(`${stageKey} FAILED: ${e.response?.data?.message || e.message}`);
      }
      await sleep(8000);
    }
  }
  log("\n=== RESUME AFTER PURGE COMPLETE ===");
}

main().catch((e) => {
  log(`FATAL: ${e.stack || e.message}`);
  process.exit(1);
});
