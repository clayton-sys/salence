-- Session 3 / Phase 3 — User-defined contexts.
-- Contexts replace the rigid profiles.domains text[] as a first-class,
-- per-user manageable concept. The old field stays for back-compat;
-- records.domain remains a text field that stores a context slug.

CREATE TABLE IF NOT EXISTS public.contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS contexts_user_idx
  ON public.contexts(user_id);

ALTER TABLE public.contexts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own contexts" ON public.contexts;
CREATE POLICY "users manage own contexts"
  ON public.contexts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Seed defaults from every existing profile's domains array.
INSERT INTO public.contexts (user_id, slug, label, is_default)
SELECT p.id, d, INITCAP(d), true
FROM public.profiles p,
     LATERAL unnest(p.domains) d
WHERE p.domains IS NOT NULL
ON CONFLICT (user_id, slug) DO NOTHING;

-- Trigger: when profiles.domains is set/changed, seed any new slugs as
-- default contexts. Runs AFTER UPDATE OF domains so onboarding creates
-- the initial set automatically.
CREATE OR REPLACE FUNCTION public.seed_user_contexts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.contexts (user_id, slug, label, is_default)
  SELECT NEW.id, d, INITCAP(d), true
  FROM unnest(
    COALESCE(NEW.domains, ARRAY['personal','work','health','family']::text[])
  ) d
  ON CONFLICT (user_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_domains_seed_contexts ON public.profiles;
CREATE TRIGGER on_profile_domains_seed_contexts
  AFTER UPDATE OF domains ON public.profiles
  FOR EACH ROW
  WHEN (
    NEW.domains IS NOT NULL
    AND (OLD.domains IS NULL OR OLD.domains IS DISTINCT FROM NEW.domains)
  )
  EXECUTE FUNCTION public.seed_user_contexts();
