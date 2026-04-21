# Salence — STATE.md

Last updated: 2026-04-21 (Session 2)

## What's built

### Scaffold
- Next.js 16.2.4 (App Router, Turbopack, React 19.2)
- Tailwind v4, TypeScript, ESLint
- Installed: `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`,
  `pdf-lib`, `uuid`, `next-pwa` (unused), `culori`, `react-markdown`,
  `remark-gfm`

### Core architecture
- `lib/supabase.ts` — browser client via `createBrowserClient`
- `lib/supabase-server.ts` — server client via `createServerClient`
- `lib/types.ts` — `MemoryRecord`, `UserProfile` (extended with
  onboarding + per-agent timestamps), `AssistantContentBlock`, etc.
- `lib/model-router.ts` — `MODEL_CONFIG` (grunt=Haiku 4.5, reason=Sonnet
  4.6), `TASK_TIER`, `modelCall` (text), `modelCallFull` (preserves
  tool_use blocks). Server-side API key from `process.env.ANTHROPIC_API_KEY`.
- `lib/memory-kernel.ts` — record CRUD + recency retrieval
- `lib/profile.ts` — profile helpers
- `lib/profile-context.tsx` — `ProfileProvider` + `useProfile()`
- `lib/theme.ts` — OKLCH derivation from seed hex (6 tokens)
- `lib/theme-provider.tsx` — client provider that writes CSS vars
- `lib/cards.ts` — 7 card tool schemas for Anthropic tool_use
- `lib/tools.ts` — real tool registry with auto vs. confirm split
- `lib/tools/impls.ts` — server-side tool implementations
- `lib/agents/*` — agent runtime (types, registry, runner, voices) +
  four agents (kitchen-steward, inbox-triage, coach, signal-keeper)
- `lib/agents-legacy.ts` — old v1 fact_extractor + expiry_watcher
  (kept for /api/agents/extract + /api/agents/expiry)

### Routes
- `/` → redirects to `/chat`
- `/auth` + `/auth/callback` — magic-link
- `/onboarding` — 5-step flow (welcome → about → domains → name+color
  → import). Writes `onboarding_completed_at`.
- `/(app)/chat` — markdown rendering via `ChatMessage`, inline card
  rendering via tool_use
- `/(app)/memory` — record grid + JSON export
- `/(app)/cortex` — agent cards, onboarding/run/settings modals
- `/(app)/settings` — assistant name + theme seed + domain picker +
  sovereignty (export/delete)
- `/api/chat` — Claude call with CARD_TOOLS attached; returns content
  blocks
- `/api/agents/extract` + `/api/agents/expiry` — legacy
- `/api/agents/[agent_id]/run` — tool-use loop for new agents
- `/api/agents/[agent_id]/onboard` — first-run interview save
- `/api/agents/[agent_id]/profile` — GET/PATCH agent_profiles
- `/api/agents/coach/log-session` — workout session logger
- `/api/tools/execute` — confirm-tool executor (called from
  ConfirmActionCard)
- `/api/drafts` — create drafts row

### Components
- `components/chat/ChatMessage.tsx` — markdown + card dispatcher
- `components/cards/` — 7 card components
  - `MealPlanCard`, `ShoppingListCard`, `WorkoutSessionCard`,
    `EmailDigestCard`, `ArticleBriefCard`, `WeeklySummaryCard`,
    `ConfirmActionCard`
- `components/agents/` — `AgentOnboardModal`, `AgentRunModal`,
  `AgentSettingsModal`

### Supabase
- `0001_init.sql` — profiles, records, agent_runs + RLS
- `0002_onboarding_and_agents.sql` — profile columns
  (onboarding_completed_at + 4 per-agent onboarded_at) +
  auto-create-profile trigger on auth.users insert
- `0003_phase2_tables.sql` — agent_profiles, drafts, agent_runs
  extensions (trigger/status/summary/records_created)

## What needs manual steps (user)

1. **Run migrations** in Supabase SQL editor (project `uqsdgccepyuztpeygckj`),
   in order:
   - `0001_init.sql` (if not already run)
   - `0002_onboarding_and_agents.sql`
   - `0003_phase2_tables.sql`
2. **Vercel env vars** — add `ANTHROPIC_API_KEY` with the same value as
   `.env.local` to Production, Preview, and Development environments.
3. Log in as Clayton + Kelsey, verify chat still works.
4. Onboard each agent from Cortex and try "Run now".

## Verification checklist

- [x] `npm run build` passes (18 routes)
- [x] `tsc --noEmit` clean
- [x] `npm run lint` clean
- [ ] Magic-link signup lands on /onboarding, completion goes to /chat
- [ ] Mobile chat: hamburger, no key prompt, markdown renders
- [ ] Color picker: pink seed → pink accents across send button, cards,
      links; neutral bg + text preserved
- [ ] Chat emits a card when asked ("show me a sample meal plan")
- [ ] Each agent first-run interview completes
- [ ] "Run now" from Cortex produces cards (Kitchen / Coach / Signal
      will; Inbox will render the Gmail-not-connected message)
- [ ] Confirm-tool routing: send_email via card_confirm_action only
- [ ] RLS: cross-user isolation on agent_profiles, drafts, records

## Deviations / notes

- `@supabase/auth-helpers-nextjs@0.15.0` is a shim for `@supabase/ssr`;
  we use `createBrowserClient` + `createServerClient` directly.
- `middleware.ts` → `proxy.ts` (Next 16).
- `next-pwa@5` is webpack-only; full SW deferred to v2.
- Gmail/Calendar tool implementations are stubs returning
  `{ error: 'not connected' }`. OAuth wiring lands in v2.
- `search_web` uses DuckDuckGo HTML scrape (no API key). V2 should swap
  in Brave/Serper/Tavily for reliability.
- Legacy fact_extractor + expiry_watcher still run via their original
  routes but no longer appear in the Cortex UI. Delete in a later pass.
- Card tool-use blocks arrive from Anthropic in the same turn as prose —
  the chat renderer mounts them inline. History is flattened to text
  for record storage.

## V2 backlog

- Vercel Cron jobs → `/api/agents/[id]/run?trigger=cron` for scheduled
  runs at each agent's `cadence_hint`
- pgvector similarity search (replace recency kernel)
- Gmail + Google Calendar OAuth (unblocks inbox-triage fully)
- Brave Search / Tavily API for `search_web`
- Money Mirror agent (5th)
- Obsidian connector via File System Access API
- Drag-and-drop uploads + clipboard paste in chat
- Landing page at salence.app (marketing)
- Document download from chat (PDF/DOCX export)
- Shared memory across agents (Kitchen reads Coach's weekly volume to
  tune protein)
- Delete legacy fact_extractor/expiry_watcher + lib/agents-legacy.ts
- Swap next-pwa for Serwist (Turbopack-compatible)
- Replace SVG PWA icons with PNGs
- Full streaming chat (Anthropic SSE) instead of one-shot response
