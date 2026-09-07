-- Adds ai_provider_keys: super_admin-managed LLM API keys (Google AI
-- Studio/Gemini for now, provider column left open for future providers).
-- RAGProductionApp polls the internal endpoint backed by this table to
-- decide whether to route text-chat completions through Gemini instead of
-- local Ollama, trying keys in priority order with automatic fallback.
-- No encryption-at-rest — follows this codebase's existing convention
-- (WhatsApp tokens, integration_settings.config) of storing secrets as
-- plain TEXT columns; secrecy is enforced at read time (masked in the
-- admin-facing API) instead.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_provider_keys (
  id            SERIAL PRIMARY KEY,
  provider      VARCHAR(50)  NOT NULL DEFAULT 'gemini',
  label         VARCHAR(150) NOT NULL,
  api_key       TEXT         NOT NULL,
  tier          VARCHAR(20)  NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  priority      INTEGER      NOT NULL DEFAULT 100,
  last_used_at  TIMESTAMPTZ,
  created_by    INTEGER,
  updated_by    INTEGER,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- RAGProductionApp's internal fetch does
-- `WHERE provider = ? AND is_active = true ORDER BY priority ASC` on every
-- cache refresh (~60s) — index the exact predicate+sort.
CREATE INDEX IF NOT EXISTS idx_ai_provider_keys_active_lookup
  ON ai_provider_keys(provider, is_active, priority);

COMMIT;
