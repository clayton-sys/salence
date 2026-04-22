-- Session 3 / Phase 6 — Maintenance foundation + suggestions.

CREATE TABLE IF NOT EXISTS public.maintenance_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_affected INTEGER,
  cost_usd NUMERIC(10, 6),
  notes TEXT,
  status TEXT DEFAULT 'running',
  error TEXT
);

CREATE INDEX IF NOT EXISTS maintenance_runs_user_task_idx
  ON public.maintenance_runs(user_id, task_id, started_at DESC);

ALTER TABLE public.maintenance_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own maintenance runs" ON public.maintenance_runs;
CREATE POLICY "users see own maintenance runs"
  ON public.maintenance_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  why_this_matters TEXT,
  proposed_config JSONB,
  status TEXT DEFAULT 'pending',
  source_task TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS suggestions_user_status_idx
  ON public.suggestions(user_id, status);

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own suggestions" ON public.suggestions;
CREATE POLICY "users manage own suggestions"
  ON public.suggestions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
