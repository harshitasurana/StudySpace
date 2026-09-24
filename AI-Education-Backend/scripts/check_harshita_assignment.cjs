require("dotenv").config();
const { Sequelize } = require("sequelize");
const sequelize = new Sequelize(process.env.DATABASE_URL || process.env.DB_URL, { logging: false });
(async () => {
  console.log("=== Harshita's user rows ===");
  const [users] = await sequelize.query(`SELECT user_id, first_name, last_name, account_email, role_id FROM users WHERE user_id IN (47,49)`);
  console.log(JSON.stringify(users, null, 2));

  console.log("=== Harshita's student profile(s) ===");
  const [profiles] = await sequelize.query(`
    SELECT student_profile_id, user_id, school_name, board_id, class_id, learning_mode
    FROM education_student_profiles WHERE user_id IN (47,49)
  `);
  console.log(JSON.stringify(profiles, null, 2));

  console.log("=== A working org-6 student's full assignment row shape (for reference) ===");
  const [ref] = await sequelize.query(`
    SELECT * FROM user_structure_assignments WHERE user_id = 51 LIMIT 1
  `);
  console.log(JSON.stringify(ref, null, 2));

  console.log("=== Any assignment row for 47/49 regardless of status/is_current ===");
  const [anyAssign] = await sequelize.query(`SELECT * FROM user_structure_assignments WHERE user_id IN (47,49)`);
  console.log(JSON.stringify(anyAssign, null, 2));

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
