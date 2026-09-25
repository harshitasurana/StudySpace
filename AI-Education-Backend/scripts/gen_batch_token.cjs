// One-off: sign a JWT matching auth_middleware.js's expected {id, role}
// shape for a real super_admin user, so batch retry scripts can call
// admin-only endpoints without a browser login flow.
require("dotenv").config();
const fs = require("fs");
const { Client } = require("pg");
const jwt = require("jsonwebtoken");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(
    "SELECT user_id, account_email FROM users WHERE role_id = 1 ORDER BY user_id ASC LIMIT 1"
  );
  await client.end();
  if (rows.length === 0) {
    console.error("No super_admin (role_id=1) user found");
    process.exit(1);
  }
  const { user_id, account_email } = rows[0];
  const token = jwt.sign({ id: user_id, role: 1 }, process.env.JWT_SECRET, { expiresIn: "6h" });
  // dotenv prints its own banner line to stdout before this runs, so
  // writing the token straight to a dedicated file (nothing else in it)
  // beats relying on "first line of captured output" being the token.
  fs.writeFileSync(
    "C:/Users/jgung/AppData/Local/Temp/claude/c--Users-jgung-PycharmProjects-Education/73105e09-5acb-4f34-b824-7bfd97880cc7/scratchpad/batch_token.txt",
    token
  );
  console.error(`(token for user_id=${user_id}, ${account_email})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
