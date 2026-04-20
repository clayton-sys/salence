# Salence — STATE.md

Last updated: 2026-04-20

## What's built (v1)

### Scaffold
- Next.js 16.2.4 (App Router, Turbopack, React 19.2)
- Tailwind v4, TypeScript, ESLint
- Installed: `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`, `pdf-lib`,
  `uuid`, `next-pwa` (unused — see PWA note)

### Core architecture
- `lib/supabase.ts` — browser client via `createBrowserClient` (session cookies, RLS-aware)
- `lib/supabase-server.ts` — server client via `createServerClient` + async `cookies()`
- `lib/types.ts` — `MemoryRecord`, `UserProfile`, `ContentType`, `Domain`,
  `RecordStatus`, `Message`, `AgentConfig`, `DOMAIN_META`, `ALL_DOMAINS`
- `lib/model-router.ts` — `MODEL_CONFIG` (grunt=Haiku 4.5, reason=Sonnet 4.6), `TASK_TIER`, `modelCall()`
- `lib/memory-kernel.ts` — `makeRecord`, `saveRecord`, `getRecentRecords`,
  `getRecordsByDomain`, `getContextForChat`, `expireRecord`, `getAllRecords`, `countActiveRecords`
- `lib/agents.ts` — `AGENT_CONFIGS` (fact_extractor, expiry_watcher, contradiction_flag),
  `runFactExtractor`, `runExpiryWatcher`, `getAgentRuns`
- `lib/profile.ts` — `getProfile`, `upsertProfile`, `deriveColorVars`, `PRESET_COLORS`
- `lib/profile-context.tsx` — `ProfileProvider` + `useProfile()` with memory count

### Routes
- `/` → redirects to `/chat`
- `/auth` — magic-link page
- `/auth/callback` — OAuth code exchange + route based on profile presence
- `/onboarding` — 6-step flow (0-5): welcome → about → domains → name+color → import → provider
- `/(app)/chat` — conversation with voice input, fact-extractor fire-and-forget
- `/(app)/memory` — record grid with domain filter + JSON export
- `/(app)/cortex` — agent cards with toggle + activity log
- `/(app)/settings` — assistant, provider/API key, model routing view, sovereignty actions
- `/api/chat` — context-aware Claude call (API key via header, never stored server-side)
- `/api/agents/extract` — fact extractor endpoint
- `/api/agents/expiry` — decay watcher endpoint

### Supabase
- `supabase/migrations/0001_init.sql` — tables: `profiles`, `records`, `agent_runs`
  with RLS policies scoped by `auth.uid()`
- Migration NOT yet run — user needs to paste it into the SQL editor of project
  `uqsdgccepyuztpeygckj`

### PWA
- `public/manifest.json` + `public/icon-192.svg` + `public/icon-512.svg` (placeholders)
- `next-pwa@5` is webpack-only and incompatible with Next 16's default Turbopack
  bundler — service worker deferred to v2 (needs Serwist or similar)

### Styles
- `app/globals.css` with DM Sans + Space Mono via `next/font`, dark-only
- CSS variables: `--bg`, `--border`, `--text`, `--accent`, plus user-color derivatives
  computed via `color-mix()`

### Proxy (was middleware)
- `proxy.ts` (renamed from `middleware.ts`; exports `proxy` fn per Next 16)
- Redirects unauthenticated users to `/auth`, signed-in users away from `/auth`

## Deviations from spec
1. `@supabase/auth-helpers-nextjs@0.15.0` is a shim for `@supabase/ssr`. The
   functions named in the spec (`createClientComponentClient`,
   `createRouteHandlerClient`, `createMiddlewareClient`) do NOT exist at this
   version. Rewrote against `createBrowserClient` + `createServerClient` + manual
   cookie `getAll`/`setAll`. Same functional behavior, RLS-compliant.
2. `middleware.ts` → `proxy.ts`. Next 16 deprecated the `middleware` file
   convention in favor of `proxy`. Behavior identical.
3. `next-pwa` was installed per spec but not wired into the build. Next 16
   defaults to Turbopack; `next-pwa@5` only supports webpack. Manifest stays
   (enables "Add to home screen"), full SW deferred to v2.
4. PWA icons are SVG placeholders (user approved). TODO: replace with PNGs.

## DoD status
- [x] `npm run build` passes (14 routes generated)
- [x] No TypeScript errors (`tsc --noEmit` clean)
- [x] ESLint clean
- [ ] Magic link auth — needs manual test after Supabase migration is run
- [ ] Onboarding saves profile — needs manual test
- [ ] API key persists in localStorage — implemented
- [ ] Chat end-to-end — needs manual test
- [ ] Memory records written — needs manual test
- [ ] Memory view — implemented
- [ ] Domain switching — implemented (active domain passed to /api/chat)
- [ ] Voice input — implemented (Web Speech API; Chrome/Edge/Safari only)
- [ ] Cortex toggles — implemented
- [ ] Settings updates profile — implemented
- [ ] Export downloads JSON — implemented
- [ ] PWA manifest — valid JSON, referenced from `<head>`; no service worker in v1
- [x] No TypeScript errors
- [ ] RLS — policies in migration file; needs migration to be run + manual verify

## Next session picks-up
1. User runs `supabase/migrations/0001_init.sql` in Supabase SQL editor
2. `npm run dev` → localhost:3000 → walk through magic-link → onboarding → chat
3. Confirm records appearing in Supabase `records` table
4. Swap next-pwa for a Turbopack-compatible PWA (Serwist) in v2
5. Replace SVG PWA icons with PNGs
6. Add pgvector similarity search (v2)
