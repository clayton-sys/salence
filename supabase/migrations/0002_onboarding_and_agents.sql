-- Salence v1.1 — onboarding gating + per-agent timestamps
-- Run in Supabase SQL editor against project uqsdgccepyuztpeygckj.

-- ─── profile columns ───────────────────────────────────────
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists kitchen_onboarded_at timestamptz,
  add column if not exists inbox_onboarded_at timestamptz,
  add column if not exists coach_onboarded_at timestamptz,
  add column if not exists signal_onboarded_at timestamptz;

-- ─── auto-create profile on first sign-in ──────────────────
-- A row must exist before the onboarding flow writes onboarding_completed_at.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profile rows for any existing users without one.
insert into public.profiles (id)
select u.id
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
