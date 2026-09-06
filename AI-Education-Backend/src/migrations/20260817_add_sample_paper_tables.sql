-- Sample Papers — Stage 0 (admin authoring of real exam papers).
--
-- A "sample paper" is a real, teacher-authored exam paper (e.g. CBSE
-- Class 9 Math/Science "Major Test") uploaded as a PDF alongside its real
-- Solution PDF. Extraction pairs each question with its real answer from
-- the Solution (see sample_paper_extraction_jobs) rather than generating
-- answers — model_answer/rubric_criteria are the grading ground truth an
-- admin fidelity-reviews before publish, not content the admin authors or
-- academically verifies from scratch.
--
-- question_type / question_media / input_type / grading_strategy are
-- deliberately independent columns on sample_paper_questions — a
-- question's pedagogical type, whether it prints its own diagram, what
-- input the student is allowed to submit, and which grading prompt
-- applies, don't imply each other (e.g. a short_answer question can still
-- reference a printed figure; a diagram_based question requires photo
-- input while a numerical one might not).
--
-- answer_source tracks whether model_answer/rubric_criteria came from the
-- real Solution PDF (the default, expected case) or the RAG-drafted
-- fallback (used only when extraction couldn't confidently match a
-- question to a Solution entry) — the admin review UI flags the fallback
-- case visibly rather than presenting it identically to solution-sourced
-- content.

BEGIN;

CREATE TABLE IF NOT EXISTS sample_papers (
  sample_paper_id           SERIAL PRIMARY KEY,
  title                     VARCHAR(200) NOT NULL,
  subject_id                INTEGER NOT NULL REFERENCES education_academic_subjects(subject_id),
  class_id                  INTEGER NOT NULL REFERENCES education_academic_classes(class_id),
  paper_type                VARCHAR(20) NOT NULL CHECK (paper_type IN ('major_test', 'semi_major')),
  source_pdf_key            VARCHAR(500),
  source_solution_pdf_key   VARCHAR(500),
  total_marks               INTEGER,
  duration_minutes          INTEGER,
  status                    VARCHAR(20) NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'pending_review', 'published', 'archived')),
  created_by                INTEGER REFERENCES users(user_id),
  approved_by               INTEGER REFERENCES users(user_id),
  approved_at               TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sample_papers_subject_class
  ON sample_papers(subject_id, class_id);

CREATE TABLE IF NOT EXISTS sample_paper_sections (
  section_id           SERIAL PRIMARY KEY,
  sample_paper_id      INTEGER NOT NULL REFERENCES sample_papers(sample_paper_id),
  section_label        VARCHAR(10) NOT NULL,
  instructions         TEXT,
  marks_per_question   INTEGER,
  order_index          INTEGER NOT NULL,
  UNIQUE (sample_paper_id, order_index)
);

CREATE TABLE IF NOT EXISTS sample_paper_questions (
  question_id          SERIAL PRIMARY KEY,
  sample_paper_id      INTEGER NOT NULL REFERENCES sample_papers(sample_paper_id),
  section_id           INTEGER REFERENCES sample_paper_sections(section_id),
  question_order       INTEGER NOT NULL,
  question_text        TEXT NOT NULL,
  question_type        VARCHAR(20) NOT NULL
                        CHECK (question_type IN ('short_answer', 'long_answer', 'numerical', 'diagram_based')),
  question_media       VARCHAR(10) NOT NULL DEFAULT 'none'
                        CHECK (question_media IN ('none', 'image')),
  question_media_key   VARCHAR(500),
  input_type           VARCHAR(20) NOT NULL
                        CHECK (input_type IN ('typed', 'photo', 'typed_or_photo')),
  grading_strategy     VARCHAR(20) NOT NULL
                        CHECK (grading_strategy IN
                          ('exact', 'numeric', 'rubric', 'handwriting_rubric', 'diagram_rubric', 'graph_rubric')),
  max_marks            INTEGER NOT NULL CHECK (max_marks > 0),
  model_answer         TEXT,
  rubric_criteria      JSONB,
  rubric_notes         TEXT,
  answer_source        VARCHAR(20) NOT NULL DEFAULT 'unmatched'
                        CHECK (answer_source IN ('solution_matched', 'rag_drafted', 'unmatched')),
  concept_tags         JSONB,
  difficulty           VARCHAR(20),
  chapter_id           INTEGER REFERENCES education_chapters(chapter_id),
  review_status        VARCHAR(20) NOT NULL DEFAULT 'ai_extracted'
                        CHECK (review_status IN ('ai_extracted', 'admin_edited', 'approved')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sample_paper_id, question_order)
);

CREATE INDEX IF NOT EXISTS idx_sample_paper_questions_paper
  ON sample_paper_questions(sample_paper_id);
CREATE INDEX IF NOT EXISTS idx_sample_paper_questions_chapter
  ON sample_paper_questions(chapter_id);

-- Node owns this table's identity/persistence; FastAPI is stateless
-- per-request and reports back via callback — same "Node owns
-- identity/persistence, FastAPI is stateless" convention as
-- education_book_ingestions.
CREATE TABLE IF NOT EXISTS sample_paper_extraction_jobs (
  id                    SERIAL PRIMARY KEY,
  sample_paper_id       INTEGER NOT NULL REFERENCES sample_papers(sample_paper_id),
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  source_filename       VARCHAR(255) NOT NULL,
  solution_filename     VARCHAR(255) NOT NULL,
  questions_extracted   INTEGER,
  error_message         TEXT,
  requested_by          INTEGER REFERENCES users(user_id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sample_paper_extraction_jobs_paper
  ON sample_paper_extraction_jobs(sample_paper_id);

COMMIT;
