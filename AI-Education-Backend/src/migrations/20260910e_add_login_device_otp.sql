-- Shared email-OTP mechanism used by two flows: signup email verification
-- (all public self-registrations) and login device verification (Student/
-- School Student/Parent logging in from an unrecognized device). Same
-- columns back both flows since they never overlap in time for one user.
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS otp_code_hash varchar(255),
  ADD COLUMN IF NOT EXISTS otp_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS otp_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS user_trusted_devices (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  label varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_trusted_devices_user_id ON user_trusted_devices(user_id);

-- Existing accounts predate email verification - don't lock anyone out
-- retroactively, only newly-registered accounts go through the gate.
UPDATE users SET email_verified_at = now() WHERE email_verified_at IS NULL;

COMMIT;
