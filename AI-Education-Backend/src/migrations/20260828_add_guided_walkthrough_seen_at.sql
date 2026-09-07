-- Guided Walkthrough — a one-time interactive UI tour shown to a self-mode
-- student right after their onboarding wizard completes, never again once
-- seen. NULL means "never shown"; a timestamp records when it was
-- completed or dismissed (either way counts as "seen" so it doesn't
-- reappear).
ALTER TABLE education_student_profiles
  ADD COLUMN IF NOT EXISTS guided_walkthrough_seen_at TIMESTAMPTZ NULL;
