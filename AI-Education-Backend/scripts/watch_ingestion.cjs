// Polls chapters-overview for ALL chapters and prints a line only for
// things worth surfacing: a NEW failure appearing anywhere, a chapter
// newly becoming fully complete, or a periodic summary — avoids flooding
// the Monitor with routine "still processing" noise across 46 chapters.
require("dotenv").config();
const fs = require("fs");
const axios = require("axios");

const TOKEN = fs
  .readFileSync(
    "C:/Users/jgung/AppData/Local/Temp/claude/c--Users-jgung-PycharmProjects-Education/73105e09-5acb-4f34-b824-7bfd97880cc7/scratchpad/batch_token.txt",
    "utf8"
  )
  .trim();

const client = axios.create({ baseURL: "http://localhost:4000/api", headers: { Authorization: `Bearer ${TOKEN}` } });

const STAGE_KEYS = ["text", "images", "enrich", "mindmap", "slidedeck", "infographic"];
const POLL_MS = 20000;
const SUMMARY_EVERY_N_POLLS = 9; // ~3 minutes

let lastStageStatus = {}; // `${chapterId}:${stageKey}` -> status
let lastFullyComplete = new Set();
let pollCount = 0;

const isFullyComplete = (c) => STAGE_KEYS.every((k) => c.stages[k]?.status === "completed");

async function poll() {
  pollCount += 1;
  try {
    const { data } = await client.get("/admin/ingestion/chapters-overview");
    const chapters = data.data;

    for (const c of chapters) {
      for (const k of STAGE_KEYS) {
        const key = `${c.chapter_id}:${k}`;
        const status = c.stages[k]?.status || "none";
        const prev = lastStageStatus[key];
        if (status === "failed" && prev !== "failed") {
          console.log(`[${new Date().toISOString()}] NEW FAILURE — ${c.chapter_name} / ${k}: ${c.stages[k]?.errorMessage || "no error message"}`);
        }
        lastStageStatus[key] = status;
      }

      const nowComplete = isFullyComplete(c);
      const wasComplete = lastFullyComplete.has(c.chapter_id);
      if (nowComplete && !wasComplete) {
        console.log(`[${new Date().toISOString()}] COMPLETE — ${c.chapter_name} (all 6 stages done)`);
        lastFullyComplete.add(c.chapter_id);
      }
    }

    if (pollCount % SUMMARY_EVERY_N_POLLS === 0) {
      const needy = chapters.filter((c) => c.needsAttention).length;
      const complete = chapters.filter(isFullyComplete).length;
      console.log(
        `[${new Date().toISOString()}] SUMMARY — ${complete}/${chapters.length} fully complete, ${needy} need attention`
      );
    }
  } catch (e) {
    console.log(`[${new Date().toISOString()}] poll error: ${e.message}`);
  }
}

console.log(`[${new Date().toISOString()}] Watching ALL chapters every ${POLL_MS / 1000}s`);
poll();
setInterval(poll, POLL_MS);
