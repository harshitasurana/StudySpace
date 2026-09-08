-- Generalizes the AI Provider Keys screen from Gemini-only to any of the
-- providers the admin lists: Google, OpenAI, Anthropic, Mistral (cloud —
-- API key + model), Groq/Together/DeepSeek/OpenRouter (fast-inference —
-- API key + base URL + model, OpenAI-compatible), Ollama/LM Studio/vLLM
-- (local — base URL + model, no key). Each key row now carries its own
-- model and base_url instead of a single global GEMINI_MODEL env var;
-- api_key becomes nullable for local providers, which don't have one.

ALTER TABLE ai_provider_keys ALTER COLUMN api_key DROP NOT NULL;
ALTER TABLE ai_provider_keys ADD COLUMN IF NOT EXISTS model VARCHAR(150);
ALTER TABLE ai_provider_keys ADD COLUMN IF NOT EXISTS base_url VARCHAR(500);

-- Backfill the existing Gemini rows with the model they've actually been
-- using all along (the GEMINI_MODEL env default) so nothing changes
-- behavior for them on deploy.
UPDATE ai_provider_keys SET model = 'gemini-2.5-flash' WHERE provider = 'gemini' AND model IS NULL;

-- One row = the system's current active provider. Seeded as 'gemini' —
-- exactly what's live today (llm_provider.py hardcoded "gemini" before
-- this) — so applying this migration never silently changes which
-- provider the AI Tutor actually calls.
CREATE TABLE IF NOT EXISTS ai_provider_settings (
  id SERIAL PRIMARY KEY,
  active_provider VARCHAR(50) NOT NULL DEFAULT 'gemini',
  updated_by INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ai_provider_settings (id, active_provider)
SELECT 1, 'gemini'
WHERE NOT EXISTS (SELECT 1 FROM ai_provider_settings);
