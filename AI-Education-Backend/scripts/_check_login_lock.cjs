require("dotenv").config();
const { Client } = require("pg");
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const u = await client.query(`
    SELECT user_id, account_email, role_id, failed_login_attempts, locked_until, is_active, deleted_at, last_login
    FROM users WHERE account_email = 'harshitasurana2005@gmail.com'
  `);
  console.log("USER:", JSON.stringify(u.rows, null, 2));
  await client.end();
})();
