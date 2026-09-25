import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function cleanImageUrl(url) {
  if (typeof url !== 'string') return url;
  if (url.includes('X-Amz-Algorithm') || url.includes('X-Amz-Credential')) {
    return url.split('?')[0];
  }
  return url;
}

function cleanPayloadImages(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  // For slide decks
  if (Array.isArray(payload.slides)) {
    payload.slides.forEach(slide => {
      if (slide.image && slide.image.image_url) {
        slide.image.image_url = cleanImageUrl(slide.image.image_url);
      }
    });
  }

  // For mind maps
  if (Array.isArray(payload.branches)) {
    const processBranch = (branch) => {
      if (branch.image && branch.image.image_url) {
        branch.image.image_url = cleanImageUrl(branch.image.image_url);
      }
      if (Array.isArray(branch.children)) {
        branch.children.forEach(processBranch);
      }
    };
    payload.branches.forEach(processBranch);
  }

  return payload;
}

async function run() {
  try {
    console.log("Starting DB image URL cleanup...");

    // Clean slide decks
    const decks = await pool.query("SELECT slide_deck_id, payload FROM education_slide_decks");
    let updatedDecks = 0;
    for (const row of decks.rows) {
      const originalPayload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const cleanedPayload = cleanPayloadImages(structuredClone(originalPayload));
      if (JSON.stringify(originalPayload) !== JSON.stringify(cleanedPayload)) {
        await pool.query(
          "UPDATE education_slide_decks SET payload = $1 WHERE slide_deck_id = $2",
          [JSON.stringify(cleanedPayload), row.slide_deck_id]
        );
        updatedDecks++;
      }
    }
    console.log(`Updated ${updatedDecks} / ${decks.rows.length} slide deck records.`);

    // Clean mind maps
    const maps = await pool.query("SELECT mind_map_id, payload FROM education_mind_maps");
    let updatedMaps = 0;
    for (const row of maps.rows) {
      const originalPayload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const cleanedPayload = cleanPayloadImages(structuredClone(originalPayload));
      if (JSON.stringify(originalPayload) !== JSON.stringify(cleanedPayload)) {
        await pool.query(
          "UPDATE education_mind_maps SET payload = $1 WHERE mind_map_id = $2",
          [JSON.stringify(cleanedPayload), row.mind_map_id]
        );
        updatedMaps++;
      }
    }
    console.log(`Updated ${updatedMaps} / ${maps.rows.length} mind map records.`);

  } catch (err) {
    console.error("Error during DB image URL cleanup:", err);
  } finally {
    await pool.end();
  }
}

run();
