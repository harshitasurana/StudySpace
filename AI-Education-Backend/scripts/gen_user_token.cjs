require("dotenv").config();
const fs = require("fs");
const jwt = require("jsonwebtoken");
const token = jwt.sign({ id: 47, role: 19 }, process.env.JWT_SECRET, { expiresIn: "1h" });
fs.writeFileSync(
  "C:/Users/jgung/AppData/Local/Temp/claude/c--Users-jgung-PycharmProjects-Education/73105e09-5acb-4f34-b824-7bfd97880cc7/scratchpad/user47_token.txt",
  token
);
console.error("done");
