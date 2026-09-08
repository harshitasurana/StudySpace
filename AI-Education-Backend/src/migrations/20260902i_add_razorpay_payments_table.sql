-- Audit trail + idempotency guard for Razorpay Pro-plan checkout. A row
-- is created 'created' when the order is requested, then flipped to
-- 'paid' only after the payment signature is verified server-side — the
-- unique index on razorpay_payment_id means a replayed/duplicate verify
-- call for the same payment can never activate a subscription twice.

CREATE TABLE IF NOT EXISTS razorpay_payments (
  id SERIAL PRIMARY KEY,
  student_profile_id INTEGER NOT NULL REFERENCES education_student_profiles(student_profile_id),
  razorpay_order_id VARCHAR(100) NOT NULL,
  razorpay_payment_id VARCHAR(100),
  amount INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  plan_tier VARCHAR(10) NOT NULL DEFAULT 'Pro',
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_razorpay_payments_order_id ON razorpay_payments (razorpay_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_razorpay_payments_payment_id ON razorpay_payments (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_student ON razorpay_payments (student_profile_id);
