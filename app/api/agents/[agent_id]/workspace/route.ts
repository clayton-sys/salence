import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { AGENTS } from '@/lib/agents/registry'
import { loadAgentContext, runAgent } from '@/lib/agents/runner'
import { modelCall } from '@/lib/model-router'
import type { MemoryRecord } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 300

interface WorkoutExercise {
  name: string
  target_sets?: number
  target_reps?: string
  target_weight?: string
  sets: Array<{ weight: string; reps: string; rpe: string }>
  notes?: string
}

interface PatchResult {
  exercise: string
  set_index: number
  weight?: string
  reps?: string
  rpe?: string
}

// Heuristic: the message looks like a set-logging patch for Coach.
// Examples that should match:
//   "first set deadlift 225 x 5 at rpe 8"
//   "log bench 135 5 8"
//   "2nd set squat 185x3x9"
// Examples that should NOT match (plan modifications):
//   "swap deadlifts for RDLs"
//   "my back is tight, can we drop squats"
function looksLikePatch(text: string): boolean {
  const s = text.toLowerCase()
  if (/\b(swap|replace|drop|skip|add|change|switch|remove|different)\b/.test(s)) {
    return false
  }
  // digits + x/×/by + digits is a strong signal
  if (/\d+\s*(x|×|by)\s*\d+/i.test(s)) return true
  // "log <word> <weight> <reps>"
  if (/\b(log|logged|set|rep|reps|rpe|lbs?|kg)\b/.test(s) && /\d/.test(s)) {
    return true
  }
  return false
}

async function tryCoachPatch(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  message: string
): Promise<
  | {
      kind: 'patch'
      summary: string
      tier: 'haiku' | 'sonnet'
      record_id: string
      exercise_index: number
      set_index: number
    }
  | null
> {
  if (!looksLikePatch(message)) return null

  // Fetch the most recent workout_session to patch.
  const { data } = await supabase
    .from('records')
    .select('*')
    .eq('user_id', userId)
    .eq('content_type', 'workout_session')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  const session = data as MemoryRecord
  const struct = session.structured_data as {
    exercises?: WorkoutExercise[]
    date?: string
    focus?: string
  }
  const exercises = struct.exercises || []
  if (exercises.length === 0) return null

  const exerciseList = exercises
    .map(
      (e, i) =>
        `[${i}] ${e.name} — target ${e.target_sets || '?'} x ${e.target_reps || '?'}`
    )
    .join('\n')

  const systemPrompt = `You convert natural-language workout logs into a JSON patch for a single exercise set.

Exercises in the current session:
${exerciseList}

Given the user's message, return ONLY a JSON object:
{ "exercise": "<exact name from the list above>", "set_index": <0-based int>, "weight": "<string>", "reps": "<string>", "rpe": "<string>" }

If the message does not describe a specific set to log, or you can't match an exercise, return null (the literal JSON null).

set_index: "first" → 0, "second" → 1, "3rd" → 2. If no set number given, infer: use the next empty slot for that exercise.

weight: include units if user mentioned them, e.g. "225 lb" or "100 kg". If no units, just the number.

Never invent an exercise that isn't in the list. Never guess if the user is ambiguous.`

  const raw = await modelCall({
    taskType: 'patch',
    systemPrompt,
    userMessage: message,
    logContext: { userId, agentId: 'coach' },
  })

  let patch: PatchResult | null
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim()
    if (cleaned.toLowerCase() === 'null') return null
    patch = JSON.parse(cleaned) as PatchResult
    if (!patch || !patch.exercise) return null
  } catch {
    return null
  }

  const idx = exercises.findIndex(
    (e) => e.name.toLowerCase() === patch!.exercise.toLowerCase()
  )
  if (idx === -1) return null

  const ex = exercises[idx]
  const setIndex = Math.max(0, Math.min(patch.set_index || 0, 10))
  // Ensure the sets array is long enough
  const sets = [...(ex.sets || [])]
  while (sets.length <= setIndex) sets.push({ weight: '', reps: '', rpe: '' })
  sets[setIndex] = {
    weight: patch.weight || sets[setIndex].weight,
    reps: patch.reps || sets[setIndex].reps,
    rpe: patch.rpe || sets[setIndex].rpe,
  }
  const updatedExercises = [...exercises]
  updatedExercises[idx] = { ...ex, sets }

  await supabase
    .from('records')
    .update({
      structured_data: { ...struct, exercises: updatedExercises },
    })
    .eq('id', session.id)

  return {
    kind: 'patch',
    tier: 'haiku',
    record_id: session.id,
    exercise_index: idx,
    set_index: setIndex,
    summary: `Logged ${ex.name} set ${setIndex + 1}: ${patch.weight || ''} × ${patch.reps || ''}${
      patch.rpe ? ` @ RPE ${patch.rpe}` : ''
    }`.trim(),
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ agent_id: string }> }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Server is missing ANTHROPIC_API_KEY.' },
      { status: 500 }
    )
  }
  const { agent_id } = await params
  const agent = AGENTS[agent_id]
  if (!agent) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 404 })
  }

  let body: { message?: string; context_slug?: string | null } = {}
  try {
    body = await req.json()
  } catch {
    /* ok */
  }
  const message = (body.message || '').trim()
  if (!message) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  }

  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // Coach-specific fast patch path (Haiku).
  if (agent_id === 'coach') {
    const patched = await tryCoachPatch(supabase, user.id, message)
    if (patched) return NextResponse.json(patched)
  }

  // Fallback: re-run the full agent with the user's message as the
  // kickoff. This is Sonnet-tier and handles plan modifications.
  const ctx = await loadAgentContext(supabase, user.id, agent)
  const { data: runRow } = await supabase
    .from('agent_runs')
    .insert({
      user_id: user.id,
      agent_id: agent.id,
      result: {},
      trigger: 'workspace',
      status: 'running',
    })
    .select('id')
    .single()

  try {
    const result = await runAgent(ctx, agent, message)
    await supabase
      .from('agent_runs')
      .update({
        result: {
          tool_calls: result.tool_calls,
          blocks: result.content,
        },
        status: 'completed',
        summary: result.summary,
      })
      .eq('id', runRow?.id ?? '')
    await supabase
      .from('agent_profiles')
      .update({ last_run_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('agent_id', agent.id)
    return NextResponse.json({
      kind: 'agent_run',
      tier: 'sonnet',
      content: result.content,
      summary: result.summary,
    })
  } catch (err) {
    await supabase
      .from('agent_runs')
      .update({
        result: { error: (err as Error).message },
        status: 'failed',
      })
      .eq('id', runRow?.id ?? '')
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
