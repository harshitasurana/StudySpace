require("dotenv").config();
const { Client } = require("pg");
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const u = await client.query("SELECT user_id, role_id, account_email FROM users WHERE user_id = 47");
  console.log("USER:", JSON.stringify(u.rows, null, 2));
  const p = await client.query("SELECT * FROM education_student_profiles WHERE user_id = 47");
  console.log("PROFILE:", JSON.stringify(p.rows, null, 2));
  await client.end();
})();
