-- Session 3 / Phase 2 — Haiku-first model router usage tracking.
-- Every Anthropic API call is logged here so we can measure per-user
-- cost, Haiku vs Sonnet share, and escalation rates.

CREATE TABLE IF NOT EXISTS public.model_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  intent TEXT NOT NULL,
  model TEXT NOT NULL,
  tier TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC(10, 6),
  escalated_from TEXT,
  agent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS model_calls_user_month_idx
  ON public.model_calls(user_id, created_at);

ALTER TABLE public.model_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own model calls" ON public.model_calls;
CREATE POLICY "users see own model calls"
  ON public.model_calls FOR SELECT
  USING (auth.uid() = user_id);
