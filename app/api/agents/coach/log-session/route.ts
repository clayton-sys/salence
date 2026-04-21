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

  // Flatten to a short content line for recency search, keep full structured_data.
  const topLine = body.exercises
    .map((e) => `${e.name}: ${e.sets.filter((s) => s.weight || s.reps).length || 0} sets`)
    .join('; ')
  const content = `Workout ${body.date}${body.focus ? ' — ' + body.focus : ''}. ${topLine}`

  const { data, error } = await supabase
    .from('records')
    .insert({
      user_id: user.id,
      content,
      content_type: 'fact',
      domain: 'health',
      tags: ['agent:coach', 'workout_session'],
      source: 'agent',
      weight: 0.8,
      status: 'active',
      contradicts: [],
      expires_hint: null,
      life_stage: null,
      structured_data: {
        content_subtype: 'workout_session',
        ...body,
      },
    })
    .select('id')
    .single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.id })
}
