require("dotenv").config();
const { Client } = require("pg");
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const ids = [212, 221, 139, 142];
  for (const id of ids) {
    const r = await client.query(
      `UPDATE education_book_ingestions
       SET status = 'failed',
           error_message = 'Backing Celery task was purged during a queue cleanup (stale message backlog) — never actually failed, just orphaned. Safe to retry.'
       WHERE id = $1 AND status = 'processing'
       RETURNING id, chapter_id, job_type`,
      [id]
    );
    console.log(r.rows.length ? `fixed job ${id}` : `job ${id} not in processing state, skipped`);
  }
  await client.end();
})();
