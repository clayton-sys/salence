/**
 * One-time cleanup: strip "0 sets" noise from pre-1.7B workout_session
 * records. Bug 1.7B's fix (filter empty sets, drop exercises with zero
 * logged sets) only applied to new sessions written through
 * /api/agents/coach/log-session — older rows still carry the noise in
 * structured_data.exercises and their `content` summary line.
 *
 * Run once, manually:
 *   npx tsx --env-file=.env.local scripts/grandfather-workout-noise.ts
 *
 * Needs: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 *
 * Safe to re-run — idempotent. Only updates records whose structured_data
 * would actually change.
 */

import { createClient } from '@supabase/supabase-js'

interface LoggedSet {
  weight?: string
  reps?: string
  rpe?: string
}

interface Exercise {
  name: string
  target_sets?: number
  target_reps?: string
  target_weight?: string
  sets?: LoggedSet[]
  notes?: string
}

interface WorkoutStructured {
  date?: string
  title?: string
  focus?: string
  exercises?: Exercise[]
}

function isLoggedSet(s: LoggedSet | undefined | null): boolean {
  if (!s) return false
  const w = (s.weight || '').toString().trim()
  const r = (s.reps || '').toString().trim()
  if (!w && !r) return false
  if ((w === '0' || w === '') && (r === '0' || r === '')) return false
  return true
}

function rebuildContent(struct: WorkoutStructured, cleaned: Exercise[]): string {
  const date = struct.date || ''
  const focus = struct.focus ? ` — ${struct.focus}` : ''
  const topLine = cleaned
    .map((e) => `${e.name}: ${(e.sets || []).length} sets`)
    .join('; ')
  return `Workout ${date}${focus}. ${topLine || 'no sets logged'}`
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.'
    )
    process.exit(1)
  }

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: records, error } = await db
    .from('records')
    .select('id, user_id, content, structured_data')
    .eq('content_type', 'workout_session')

  if (error) {
    console.error('Fetch failed:', error.message)
    process.exit(1)
  }
  if (!records || records.length === 0) {
    console.log('No workout_session records. Nothing to do.')
    return
  }

  console.log(`Scanning ${records.length} workout_session record(s)...`)

  let touched = 0
  let skipped = 0
  for (const r of records) {
    const struct = (r.structured_data || {}) as WorkoutStructured
    const exercises = struct.exercises || []
    if (exercises.length === 0) {
      skipped++
      continue
    }

    const cleaned: Exercise[] = exercises
      .map((e) => ({
        ...e,
        sets: (e.sets || []).filter(isLoggedSet),
      }))
      .filter((e) => (e.sets || []).length > 0)

    const beforeCount = exercises.length
    const beforeSets = exercises.reduce(
      (n, e) => n + (e.sets || []).length,
      0
    )
    const afterCount = cleaned.length
    const afterSets = cleaned.reduce((n, e) => n + (e.sets || []).length, 0)

    if (beforeCount === afterCount && beforeSets === afterSets) {
      skipped++
      continue
    }

    const nextStruct = { ...struct, exercises: cleaned }
    const nextContent = rebuildContent(struct, cleaned)

    const { error: updErr } = await db
      .from('records')
      .update({ structured_data: nextStruct, content: nextContent })
      .eq('id', r.id)
    if (updErr) {
      console.error(`  [${r.id}] update failed: ${updErr.message}`)
      continue
    }
    touched++
    console.log(
      `  [${r.id}] ${beforeCount} ex / ${beforeSets} sets → ${afterCount} ex / ${afterSets} sets`
    )
  }

  console.log(`\nDone. Touched ${touched}. Skipped ${skipped} (already clean).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
