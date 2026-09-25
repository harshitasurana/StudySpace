require("dotenv").config();
const jwt = require("jsonwebtoken");
const token = jwt.sign({ id: 36, role: 1 }, process.env.JWT_SECRET, { expiresIn: "1h" });

const plan = [
  { chapter_id: 54, need: ["mindmap"] },
  { chapter_id: 55, need: ["mindmap"] },
  { chapter_id: 28, need: ["mindmap", "slidedeck", "infographic"] },
  { chapter_id: 56, need: ["mindmap"] },
  { chapter_id: 29, need: ["mindmap", "slidedeck", "infographic"] },
  { chapter_id: 57, need: ["mindmap"] },
  { chapter_id: 30, need: ["mindmap", "slidedeck", "infographic"] },
  { chapter_id: 58, need: ["mindmap"] },
  { chapter_id: 31, need: ["mindmap", "slidedeck", "infographic"] },
  { chapter_id: 59, need: ["mindmap"] },
  { chapter_id: 32, need: ["mindmap", "slidedeck", "infographic"] },
  { chapter_id: 33, need: ["mindmap", "slidedeck", "infographic"] },
  { chapter_id: 9, need: ["infographic"] },
  { chapter_id: 15, need: ["infographic"] },
  { chapter_id: 16, need: ["infographic"] },
  { chapter_id: 17, need: ["infographic"] },
  { chapter_id: 18, need: ["infographic"] },
  { chapter_id: 19, need: ["infographic"] },
  { chapter_id: 20, need: ["infographic"] },
  { chapter_id: 21, need: ["infographic"] },
  { chapter_id: 44, need: ["slidedeck"] },
  { chapter_id: 45, need: ["mindmap"] },
  { chapter_id: 46, need: ["mindmap"] },
  { chapter_id: 49, need: ["mindmap"] },
  { chapter_id: 50, need: ["mindmap"] },
  { chapter_id: 51, need: ["mindmap"] },
];

const run = async () => {
  for (const { chapter_id, need } of plan) {
    const form = new FormData();
    form.append("steps", JSON.stringify(need));
    try {
      const res = await fetch(`http://localhost:4000/api/admin/ingestion/chapters/${chapter_id}/process`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const body = await res.json();
      console.log(chapter_id, need.join(","), "->", res.status, body.message || JSON.stringify(body));
    } catch (e) {
      console.log(chapter_id, need.join(","), "-> ERROR", e.message);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
};

run();
