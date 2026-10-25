// One-off: Social Studies (subject_id=4) was inserted via raw SQL earlier
// this session (backend was down at data-entry time), bypassing
// createSubjectService — the only place that calls
// backfillSubjectForExistingStudents to add a new subject to every
// existing student's education_student_subjects row. Runs that same
// backfill now, for real, against the live app (not a duplicate raw SQL
// insert) so it goes through the actual ignoreDuplicates-safe bulkCreate.
require("dotenv").config();
const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows: subjRows } = await client.query(
    "SELECT subject_id, board_id, class_id FROM education_academic_subjects WHERE subject_id = 4"
  );
  if (subjRows.length === 0) {
    console.error("Subject 4 not found");
    process.exit(1);
  }
  const subject = subjRows[0];

  const where = [];
  const params = [];
  if (subject.board_id) {
    params.push(subject.board_id);
    where.push(`board_id = $${params.length}`);
  }
  if (subject.class_id) {
    params.push(subject.class_id);
    where.push(`class_id = $${params.length}`);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows: profiles } = await client.query(
    `SELECT student_profile_id FROM education_student_profiles ${whereClause}`,
    params
  );
  console.log(`${profiles.length} matching student profile(s)`);

  let added = 0;
  for (const p of profiles) {
    const res = await client.query(
      `INSERT INTO education_student_subjects (student_profile_id, subject_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [p.student_profile_id, subject.subject_id]
    );
    added += res.rowCount;
  }
  console.log(`Added Social Studies to ${added} student(s)`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
