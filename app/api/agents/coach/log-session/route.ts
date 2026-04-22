import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

interface LogBody {
  tool_use_id?: string
  date: string
  title?: string
  focus?: string
  exercises: Array<{
    name: string
    target_sets?: number
    target_reps?: string
    target_weight?: string
    sets: Array<{ weight: string; reps: string; rpe: string }>
    notes?: string
  }>
}

function isLoggedSet(s: { weight?: string; reps?: string }): boolean {
  const w = (s.weight || '').toString().trim()
  const r = (s.reps || '').toString().trim()
  // A set counts as logged if the user entered any weight or reps.
  // Empty or "0" both mean "didn't do it".
  if (!w && !r) return false
  if ((w === '0' || w === '') && (r === '0' || r === '')) return false
  return true
}

export async function POST(req: Request) {
  let body: LogBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // Filter out exercises with zero logged sets entirely — the user
  // didn't actually do them.
  const loggedExercises = (body.exercises || [])
    .map((e) => ({
      ...e,
      sets: (e.sets || []).filter(isLoggedSet),
    }))
    .filter((e) => e.sets.length > 0)

  const topLine = loggedExercises
    .map((e) => `${e.name}: ${e.sets.length} sets`)
    .join('; ')
  const content = `Workout ${body.date}${body.focus ? ' — ' + body.focus : ''}. ${
    topLine || 'no sets logged'
  }`

  const { data, error } = await supabase
    .from('records')
    .insert({
      user_id: user.id,
      content,
      content_type: 'workout_session',
      domain: 'health',
      tags: ['agent:coach'],
      source: 'agent',
      weight: 0.8,
      status: 'active',
      contradicts: [],
      expires_hint: null,
      life_stage: null,
      structured_data: {
        date: body.date,
        title: body.title,
        focus: body.focus,
        exercises: loggedExercises,
      },
    })
    .select('id')
    .single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.id })
}
