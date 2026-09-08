-- Chapter Reader redesign: the reader now renders the real chapter PDF
-- directly in the browser (react-pdf/pdf.js) instead of a vision-
-- transcribed/reformatted Markdown version cached here. That approach
-- was both slow (one vision call per page) and had genuinely started
-- timing out for real chapters. Confirmed empty (0 rows) before writing
-- this — nothing is lost.

BEGIN;

DROP TABLE IF EXISTS education_chapter_content;

COMMIT;
