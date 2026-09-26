// One-off: retries every failed/pending stage across every chapter that
// needsAttention in the new chapter-overview endpoint (see
// getChapterProcessingOverviewService). Runs stages SEQUENTIALLY with a
// gap between each — RAGProductionApp is a single synchronous process
// (background generation tasks share its one event loop), and firing many
// retries in parallel is exactly what hung it once already this session.
// text/images PDFs are matched by chapter name against the cleaned batch
// in Downloads/_cleaned_for_ingestion/.
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
  "C:/Users/jgung/AppData/Local/Temp/claude/c--Users-jgung-PycharmProjects-Education/73105e09-5acb-4f34-b824-7bfd97880cc7/scratchpad/retry_all_failed.log";
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GAP_MS = 8000; // breathing room between requests for the single-process AI service

async function retryJob(jobId, filePath) {
  const form = new FormData();
  if (filePath) form.append("file", fs.createReadStream(filePath));
  const headers = filePath ? form.getHeaders() : {};
  return client.post(`/admin/ingestion/${jobId}/retry`, filePath ? form : undefined, { headers });
}

async function retryGeneration(chapterId, stageKey) {
  const form = new FormData();
  form.append("steps", JSON.stringify([stageKey]));
  return client.post(`/admin/ingestion/chapters/${chapterId}/process`, form, { headers: form.getHeaders() });
}

async function main() {
  log(`=== RETRY-ALL-FAILED START (pdf dir has ${pdfFiles.length} files) ===`);
  const { data } = await client.get("/admin/ingestion/chapters-overview");
  const chapters = (data.data || []).filter((c) => c.needsAttention);
  log(`${chapters.length} chapters need attention`);

  const summary = [];

  for (const ch of chapters) {
    log(`\n### ${ch.chapter_name} (chapter_id=${ch.chapter_id}) ###`);
    const result = { chapter: ch.chapter_name, chapter_id: ch.chapter_id };

    // text
    const text = ch.stages.text;
    if (text && (text.status === "failed" || text.status === "pending")) {
      try {
        if (text.hasStorageKey) {
          await retryJob(text.jobId, null);
          result.text = "retried (reused stored PDF)";
        } else {
          const pdf = findPdfFor(ch.chapter_name);
          if (!pdf) throw new Error(`no matching PDF found in ${PDF_DIR}`);
          await retryJob(text.jobId, pdf);
          result.text = `retried (uploaded ${path.basename(pdf)})`;
        }
        log(`text -> ${result.text}`);
      } catch (e) {
        result.text = `ERROR: ${e.response?.data?.message || e.message}`;
        log(`text FAILED: ${result.text}`);
      }
      await sleep(GAP_MS);
    }

    // images
    const images = ch.stages.images;
    if (images && (images.status === "failed" || images.status === "pending")) {
      try {
        const pdf = findPdfFor(ch.chapter_name);
        if (!pdf) throw new Error(`no matching PDF found in ${PDF_DIR}`);
        await retryJob(images.jobId, pdf);
        result.images = `retried (uploaded ${path.basename(pdf)})`;
        log(`images -> ${result.images}`);
      } catch (e) {
        result.images = `ERROR: ${e.response?.data?.message || e.message}`;
        log(`images FAILED: ${result.images}`);
      }
      await sleep(GAP_MS);
    }

    // enrich — will legitimately no-op/error if images isn't completed
    // yet (often true in this same pass); that's fine, it'll pick up
    // naturally via the images-completion chaining once images lands, or
    // a later run of this script.
    const enrich = ch.stages.enrich;
    if (enrich && (enrich.status === "failed" || enrich.status === "pending")) {
      try {
        await retryJob(enrich.jobId, null);
        result.enrich = "retried";
        log(`enrich -> retried`);
      } catch (e) {
        result.enrich = `skipped: ${e.response?.data?.message || e.message}`;
        log(`enrich skipped: ${result.enrich}`);
      }
      await sleep(GAP_MS);
    }

    // mindmap/slidedeck/infographic — need text completed; will
    // legitimately error otherwise, same reasoning as enrich above.
    for (const stageKey of ["mindmap", "slidedeck", "infographic"]) {
      const stage = ch.stages[stageKey];
      if (stage && stage.status === "failed") {
        try {
          await retryGeneration(ch.chapter_id, stageKey);
          result[stageKey] = "retried";
          log(`${stageKey} -> retried`);
        } catch (e) {
          result[stageKey] = `skipped: ${e.response?.data?.message || e.message}`;
          log(`${stageKey} skipped: ${result[stageKey]}`);
        }
        await sleep(GAP_MS);
      }
    }

    summary.push(result);
  }

  log("\n=== RETRY-ALL-FAILED COMPLETE ===");
  log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  log(`FATAL: ${e.stack || e.message}`);
  process.exit(1);
});
