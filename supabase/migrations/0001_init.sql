-- Salence v1 initial schema
-- Run in the Supabase SQL editor against project uqsdgccepyuztpeygckj.

-- ─── extensions ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── profiles ───────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  provider text default 'claude',
  domains text[] default array['personal']::text[],
  user_color text default '#C8A96E',
  assistant_name text,
  created_at timestamptz not null default now(),
  settings jsonb not null default '{}'::jsonb
);

-- ─── records ────────────────────────────────────────────────
create table if not exists public.records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  content_type text not null default 'conversation',
  domain text not null default 'personal',
  tags text[] not null default array[]::text[],
  source text not null default 'chat',
  vector double precision[] not null default array[]::double precision[],
  weight real not null default 0.5,
  status text not null default 'active',
  contradicts text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  last_accessed timestamptz not null default now(),
  expires_hint timestamptz,
  life_stage text,
  structured_data jsonb not null default '{}'::jsonb
);

create index if not exists records_user_id_idx on public.records(user_id);
create index if not exists records_user_domain_status_idx
  on public.records(user_id, domain, status);
create index if not exists records_user_status_created_idx
  on public.records(user_id, status, created_at desc);

-- ─── agent_runs ─────────────────────────────────────────────
create table if not exists public.agent_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  ran_at timestamptz not null default now(),
  result jsonb not null default '{}'::jsonb
);

create index if not exists agent_runs_user_id_idx on public.agent_runs(user_id);
create index if not exists agent_runs_user_ran_idx
  on public.agent_runs(user_id, ran_at desc);

-- ─── RLS ────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.records enable row level security;
alter table public.agent_runs enable row level security;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update using (auth.uid() = id);

drop policy if exists "records read own" on public.records;
create policy "records read own"
  on public.records for select using (auth.uid() = user_id);

drop policy if exists "records insert own" on public.records;
create policy "records insert own"
  on public.records for insert with check (auth.uid() = user_id);

drop policy if exists "records update own" on public.records;
create policy "records update own"
  on public.records for update using (auth.uid() = user_id);

drop policy if exists "records delete own" on public.records;
create policy "records delete own"
  on public.records for delete using (auth.uid() = user_id);

drop policy if exists "agent_runs read own" on public.agent_runs;
create policy "agent_runs read own"
  on public.agent_runs for select using (auth.uid() = user_id);

drop policy if exists "agent_runs insert own" on public.agent_runs;
create policy "agent_runs insert own"
  on public.agent_runs for insert with check (auth.uid() = user_id);
