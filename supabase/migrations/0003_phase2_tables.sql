-- Salence v1.2 — Phase 2 harness tables
-- Run in Supabase SQL editor against project uqsdgccepyuztpeygckj.

-- ─── agent_profiles (per-agent user prefs) ─────────────────
create table if not exists public.agent_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  display_name text,
  voice text default 'assistant',
  enabled boolean default true,
  last_run_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, agent_id)
);

create index if not exists agent_profiles_user_idx on public.agent_profiles(user_id);

alter table public.agent_profiles enable row level security;

drop policy if exists "agent_profiles all own" on public.agent_profiles;
create policy "agent_profiles all own"
  on public.agent_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── drafts (email, post, calendar event) ──────────────────
create table if not exists public.drafts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_type text not null,
  content jsonb not null,
  status text not null default 'pending',
  agent_id text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists drafts_user_status_idx on public.drafts(user_id, status);

alter table public.drafts enable row level security;

drop policy if exists "drafts all own" on public.drafts;
create policy "drafts all own"
  on public.drafts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── agent_runs extensions ─────────────────────────────────
alter table public.agent_runs
  add column if not exists trigger text default 'user',
  add column if not exists status text default 'completed',
  add column if not exists summary text,
  add column if not exists records_created uuid[];
