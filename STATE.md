# Salence — STATE.md

Last updated: 2026-04-22 (Session 4 — v1.4 shipped)

## Session 4 — v1.4 bug fixes + UX polish (shipped)

Solo dev, committed on `main`, one commit per phase.

### P1 — model_calls logging actually fires (commit 45de03e)
- Migration 0004 enabled RLS with only a SELECT policy — every insert
  from the user-scoped supabase client was silently denied, and
  `logModelCall` wrapped the failure in a bare `catch {}`. Result:
  cost-tracking table dead on arrival despite the Session 3 call-site
  instrumentation being correct.
- `logModelCall` now uses `getServiceSupabase()` internally (RLS bypass
  is intentional for server-side cost tracking) and surfaces insert
  errors via `console.error` so regressions show up in Vercel logs.
- Dropped the unused `supabase` field from `LogContext` and from all
  six call sites (`/api/chat`, `/api/agents/extract`, agent runner,
  coach workspace patch, maintenance tagger + pattern-finder).

### P2 — workspace layout keeps the artifact visible (commit e0f02e7)
- Chat messages now keyed by stable `crypto.randomUUID()` IDs — plus a
  `busyRef` so a fast double-submit can't race past the React `busy`
  state. Kills the "double response" glitch.
- The patch endpoint returns `exercise_index` + `set_index` so the UI
  can target the exact row that changed.
- `WorkoutSessionCard` now seeds its local log state from
  `logged_sets` (used to render as empty — a Session 3 oversight),
  accepts a `flashTarget` prop, and animates Solar Gold 30% → 0% over
  800ms on the matching row via keyframes. Scrolls the row into view
  first if off-screen. Prop-to-state sync uses React 19's render-time
  idiom to satisfy `react-hooks/set-state-in-effect`.
- Workspace renders `WorkoutSessionCard` directly for Coach (so it
  can pass `flashTarget`) and keeps the `ChatMessage` path for the
  other three agents.
- Non-patch runs now put only `data.summary` in the chat bubble — the
  full blocks live in the artifact pane — killing the visual "two
  identical responses" effect on non-Coach agents.
- Layout: grid flipped to 60/40 chat/artifact, sticky artifact header
  with `Last updated` stamp, independent pane scroll. Mobile
  (<1024px) collapses the artifact to a 60px sticky peek that
  expands to a full-screen overlay (replaces the old tab toggle).
- Split `getServiceSupabase` into `lib/supabase-service.ts` so
  `model-router.ts` can import it without poisoning client bundles
  with `next/headers` (`/settings` pulls `model-router` for the
  tier panel).

### P3 — onboarding replaces, doesn't layer (commit e1bcb5b)
- `/api/agents/[agent_id]/onboard` now hard-deletes prior records
  matching `(user_id, tags @> ['agent:<id>', 'onboarding'])` before
  inserting the fresh set. Delete count (or error) logged to console.

### P4 — workout card cleanup (commit 7c9a4ec)
- New `scripts/grandfather-workout-noise.ts` — idempotent one-time
  cleanup for pre-1.7B workout_session records (strips "0 sets"
  noise from `structured_data.exercises` and rebuilds the `content`
  summary line to match).
- 1.7A was already in place — `/api/agents/coach/log-session` writes
  `content_type: 'workout_session'` at route.ts:67. Needs a live
  post-deploy run to confirm.

### P5 — Session 3 code-verification
Verified by code-read; runtime checks flagged for Clayton below.
- Kitchen Steward + Signal Keeper: `tools` arrays include
  `search_web`; `lib/tools/search/index.ts` defaults to Brave when
  `SEARCH_PROVIDER` is unset. Failure-handling block in
  `lib/agents/shared.ts`. Runtime needs `BRAVE_API_KEY`.
- `/notes` page: CRUD + markdown/obsidian/notion export wired.
- Contexts: `components/settings/ContextsSection` + chat chips at
  `components/chat/*` (already exercised in Session 3 QA).
- Maintenance: `/api/maintenance/run` accepts both
  `Authorization: Bearer $CRON_SECRET` and
  `x-maintenance-secret: $MAINTENANCE_SECRET` — use the
  `x-maintenance-secret` form for manual triggers (the v1.4 prompt
  mentioned `Bearer $MAINTENANCE_SECRET`, which is not what the
  route checks for).

## Manual verification (Clayton, post-deploy)

1. **Run the grandfather script once:**
   ```
   npx tsx --env-file=.env.local scripts/grandfather-workout-noise.ts
   ```
   Expect per-record diff lines + a final `Touched N. Skipped M.` summary.

2. **`model_calls` fires:** run any agent (Coach workspace is fastest)
   then
   ```sql
   SELECT tier, agent_id, COUNT(*), SUM(cost_usd)
   FROM model_calls
   WHERE user_id = '7a817f48-cbec-4957-909c-81f0d5748af4'
   GROUP BY tier, agent_id
   ORDER BY COUNT(*) DESC;
   ```

3. **Coach workspace:** message `first set deadlift 225 x 5 rpe 8` —
   artifact stays visible, row 1 flashes gold, no duplicate reply.
   Then `swap deadlifts for RDLs` — falls through to Sonnet agent run;
   chat bubble shows summary only, artifact updates.

4. **Re-onboarding:** re-run Coach interview, verify
   ```sql
   SELECT COUNT(*) FROM records
   WHERE user_id = '<clayton>'
     AND tags @> ARRAY['agent:coach', 'onboarding'];
   ```
   returns exactly 8, not 16.

5. **Mobile:** resize viewport below 1024px — artifact becomes a 60px
   sticky peek, tap opens full-screen overlay with close button.

6. **Kitchen Steward / Signal Keeper** (needs `BRAVE_API_KEY` set):
   run each from Cortex; verify real URLs + artifact render + a
   corresponding `model_calls` row.

7. **Maintenance manual trigger:**
   ```
   curl -X POST $APP_URL/api/maintenance/run \
     -H "x-maintenance-secret: $MAINTENANCE_SECRET"
   ```
   Expect `{ ok: true, users: N, results: [...] }` and a
   `maintenance_runs` row per user.

8. **Kelsey:** sign in, hit the strict gate, complete onboarding, run
   one agent successfully.

## Session 3 — v1.3 fixes + v2 foundation (shipped)

### Phase 1 — v1.3 bug fixes (commit a0c5851)
- Interview rename field no longer crashes on highlight-and-retype.
  `AgentOnboardModal` seeds its `answers` map with every text/number
  question's `default` at init so every input is fully controlled from
  render #1.
- Success state: the interview modal shows a 1.5s ✓ screen ("You're
  all set with {name}. Tap Run now to start.") before closing.
- Cortex tile is no longer stale after onboarding: `onDone` now calls
  `refreshProfile()` in addition to `router.refresh()`.
- Kitchen Steward no longer fabricates when search fails. System
  prompt: hard refuse + honest error card when `search_web` returns
  empty/error. Every recipe must include a real `source_url`.
- Kitchen Steward respects `meals_per_week` exactly (3 means 3).
- `search_web` swapped from DDG HTML scrape to Brave Search API via
  a new provider abstraction at `lib/tools/search/`:
  - `index.ts` — `search_web(input)` picks provider via
    `SEARCH_PROVIDER` env (default 'brave')
  - `providers/brave.ts` — Brave Search implementation, supports
    `freshness` (day/week/month/year)
  - `providers/duckduckgo.ts` — kept as fallback
  - `types.ts` — `SearchResult { title, url, snippet, published_date }`
  - Tool now returns `{ results, error }` so agents distinguish "no
    results" from "tool broken"
- Coach log-session: writes `content_type='workout_session'` (was
  'fact' + tag), drops the `workout_session` tag, and filters out
  exercises with zero logged sets. Summary only mentions what was
  actually done.
- Shared `FAILURE_HANDLING_BLOCK` added to all four agent system
  prompts (via `lib/agents/shared.ts`).
- `ContentType` widened to include `note`, `workout_session`,
  `meal_plan`, `daily_brief`, `email_digest`.

### Phase 2 — Haiku-first model router (commit 7a71603)
- `lib/model-router.ts` now uses `TaskIntent`:
  - Haiku: `extract | categorize | patch | summarize_short | tag |
    quick_reply`
  - Sonnet: `plan | generate_artifact | compose | configure_agent`
- Legacy `TaskType` (chat, agent_run, etc.) preserved; internally
  resolves to a tier.
- `modelFor(intent)` → `{ model, tier }`
- `modelCallWithEscalation`: run Haiku, validate; if invalid, retry
  once on Sonnet. Both calls log separately with `escalated_from`.
- `LogContext` on both `modelCall` and `modelCallFull` writes a row
  into `model_calls` after every API response (usage tokens + cost
  estimate). Non-blocking on failure.
- `model_calls` table: migration `0004_model_calls.sql` with per-user
  RLS and `(user_id, created_at)` index.
- Instrumented `/api/chat`, `/api/agents/extract`, and the agent
  runner.
- Extractor prompt now recognizes note-trigger phrases ("remember
  that", "save this as a note", "note:", "jot down") and emits
  `contentType='note'`.
- Settings → Model routing panel renamed Grunt/Reason → Haiku/Sonnet.

### Phase 3 — user-defined contexts (commit b6fbc99)
- `contexts` table (migration `0005_contexts.sql`) + seeded from
  existing `profiles.domains` + trigger seeds new slugs when domains
  is set/updated.
- `lib/contexts.ts` — typed CRUD + `toSlug` + `countRecordsForContext`.
- `ProfileProvider` exposes `contexts`, `activeContextSlug` (null =
  "all"), `setActiveContextSlug`, `refreshContexts`.
- Settings → Contexts section (`components/settings/ContextsSection`)
  with add/edit/delete + "X records use this" warning on delete.
- Chat page: context chips above the input filter memory scope; tap
  an active chip to clear. `/api/chat` scopes memory to the active
  slug; `/api/agents/extract` tags new records with it.
- `MemoryRecord.domain` widened from the `Domain` union to `string`
  so user-defined slugs work end-to-end. `/memory` guards
  `DOMAIN_META` lookup.

### Phase 4 — notes view + export hatch (commit 60b2421)
- `/notes` page: content_type='note' records, filter by context chip,
  substring search, inline edit, copy, delete.
- Chat quick-add: "save note: …" or "note: …" short-circuits the
  extractor and writes a note tagged with the active context.
- Chat system prompt: Lumen lists notes on "show my notes" and links
  to `[Notes](/notes)`.
- Export menu: Markdown (grouped by context), Obsidian (frontmatter
  enriched), Notion snapshot (stubbed — explains MCP connector not
  yet wired).
- Sidebar nav: Notes lives between Chat and Memory.

### Phase 5 — workspace layout (commit 9f2b8a5)
- `/cortex/[agent_id]` split-pane workspace:
  - Left: agent-scoped chat
  - Right: live artifact (Coach builds a synthetic
    `card_workout_session` from the latest `workout_session` record;
    other agents render the most recent `agent_run.result.blocks`)
- `/api/agents/[agent_id]/workspace` endpoint:
  - Coach-specific Haiku patch fast-path: regex gate (`looksLikePatch`)
    screens out plan modifications ("swap deadlifts for RDLs"); if
    the message passes, Haiku returns `{ exercise, set_index, weight,
    reps, rpe }` and the latest workout_session's `structured_data.
    exercises` is updated in-place
  - Everything else falls through to a full Sonnet `agent_run` with
    the user message as kickoff, persisted to `agent_runs`
- Agent runner now persists `result.blocks` so history drawer
  rehydrates artifacts.
- Cortex tiles: "Open workspace" is the primary action; "Quick run"
  keeps the modal-flow.
- Mobile: tab toggle between Chat and Artifact.

### Phase 6 — maintenance foundation + Pattern Finder (commit caa2573)
- migrations `0006_maintenance.sql`: `maintenance_runs` +
  `suggestions` tables with per-user RLS.
- `lib/maintenance/` — runner, registry, and three tasks:
  - **deduplicator** (daily, pure SQL): exact + token-overlap near
    dupes (0.95 similarity) within the same domain+content_type;
    keeps earliest/longest.
  - **tagger** (daily, Haiku): batches of 20 records with
    `domain='personal'` get re-assigned to a user's custom contexts
    via a single Haiku call per batch. Skips if user has only
    defaults.
  - **pattern-finder** (Sunday-only weekly, Haiku per cluster):
    detects repeated intents (shared keyword buckets of 5+),
    recurring content types (10+), and day-of-week rhythms (>30% of
    activity on one day). Filters out patterns already covered by
    active agent_profiles. Caps at 3 pending suggestions/user.
- `/api/maintenance/run` endpoint — service-role client iterates all
  profiles. Auth accepts either `Authorization: Bearer ${CRON_SECRET}`
  (Vercel Cron) or `x-maintenance-secret` header (manual trigger).
- `vercel.json` cron entry at `0 3 * * *` (03:00 UTC daily).
- `lib/supabase-server.ts` exports `getServiceSupabase()` for trusted
  jobs.
- Cortex "Suggested for you" section renders pending suggestions
  with Try it / Not interested actions; both update
  `suggestions.status`.

## What needs manual steps (user)

1. **Run new migrations in Supabase SQL editor** in order:
   - `0004_model_calls.sql`
   - `0005_contexts.sql`
   - `0006_maintenance.sql`
2. **Environment variables**:
   - `BRAVE_API_KEY` — sign up at
     https://api.search.brave.com/app/subscriptions/subscribe
     (free tier), add to `.env.local` and Vercel (Prod/Preview/Dev).
     **Until this lands, search_web returns a clean error — Kitchen
     Steward and Signal Keeper run-nows will render the no-fabricate
     error card.**
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Settings → API,
     add to `.env.local` and Vercel. Required for the maintenance
     runner.
   - One of:
     - `CRON_SECRET` — for Vercel Cron (preferred in prod)
     - `MAINTENANCE_SECRET` — for manual `x-maintenance-secret`
       triggers
   - Optional: `SEARCH_PROVIDER=brave` (default) or `duckduckgo`.
3. **Test the workspace** on `/cortex/coach`: message like
   "first set deadlift 225 x 5 rpe 8" should trigger the Haiku
   patch path; "swap deadlifts for RDLs" should fall through to a
   Sonnet run.
4. **Trigger maintenance manually** once to verify:
   ```
   curl -X POST $APP_URL/api/maintenance/run \
     -H "x-maintenance-secret: $MAINTENANCE_SECRET"
   ```

## Verification checklist

- [x] `npm run build` passes
- [x] `npx tsc --noEmit` clean
- [x] `npm run lint` clean
- [ ] Migrations 0004, 0005, 0006 applied
- [ ] `BRAVE_API_KEY` set; Kitchen Steward run now emits real recipes
      with real URLs
- [ ] Signal Keeper run now emits real article brief with real links
- [ ] Onboarding: rename field, highlight + retype, no crash;
      success screen shows; Cortex tile flips to Run now without
      manual refresh
- [ ] Context chips filter chat scope in `/chat`
- [ ] `/notes` renders, export as Markdown works
- [ ] `/cortex/coach` workspace renders; patch flow logs a set;
      plan-change flow runs a fresh agent turn
- [ ] `/api/maintenance/run` with secret returns 200 with per-user
      summaries
- [ ] `select tier, count(*) from model_calls group by tier` shows
      Haiku dominant in extraction/tagging

## Deviations / notes

- Chat history was preserved (user explicitly deferred the sessions
  model to v2.1).
- The 4 existing agents remain bespoke — no agent-builder framework
  yet.
- Haiku migration only covers the new/instrumented call sites in
  this session. Inside-agent intents (e.g., Inbox Triage's
  categorization pass) still run at the agent's top-level Sonnet
  tier — they'll migrate to Haiku when the runner gains intent
  dispatch in v2.1.
- Patch fast-path only implemented for Coach. Kitchen Steward's
  "change Monday dinner" and Signal Keeper's fine-grained edits
  still route through the Sonnet agent-run fallback.
- Notion snapshot export is stubbed — will wire the MCP Notion
  connector in v2.1.

## v2.1 backlog

- Retire chat history for session model (user decision).
- Full agent builder (user-created agents with spirit + DSL).
- Convert the 4 bespoke agents into templates under the builder.
- Plan gating via usage budgets on `model_calls` (table is ready).
- Gmail + Google Calendar OAuth (unblocks Inbox Triage).
- Landing page at salence.app (marketing).
- Mobile polish pass on workspace layout.
- Onboarding reducer (skip questions memory already knows).
- Contradiction detector, drift monitor, summarizer maintenance
  tasks.
- Patch fast-path for Kitchen Steward + Signal Keeper artifacts.
- Inbox Triage: route the first-pass categorization through Haiku,
  keep Sonnet only for drafts.
- Notion MCP snapshot for Notes export.
- pgvector similarity search (replace recency kernel).
- Obsidian connector via File System Access API.
- Drag-and-drop uploads + clipboard paste in chat.
- Document download from chat (PDF/DOCX export).
- Shared memory across agents (Kitchen reads Coach's weekly volume
  to tune protein).
- Delete legacy fact_extractor/expiry_watcher + lib/agents-legacy.ts.
- Replace SVG PWA icons with PNGs.
- Full streaming chat (Anthropic SSE).
