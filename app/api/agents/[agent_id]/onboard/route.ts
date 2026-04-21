import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { AGENTS } from '@/lib/agents/registry'

export const runtime = 'nodejs'

const TIMESTAMP_COL: Record<string, string> = {
  'kitchen-steward': 'kitchen_onboarded_at',
  'inbox-triage': 'inbox_onboarded_at',
  coach: 'coach_onboarded_at',
  'signal-keeper': 'signal_onboarded_at',
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ agent_id: string }> }
) {
  const { agent_id } = await params
  const agent = AGENTS[agent_id]
  if (!agent) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 404 })
  }

  let body: {
    answers: Record<string, string | string[] | number>
  }
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

  const answers = body.answers || {}
  const displayName =
    (answers.display_name as string) || agent.default_display_name
  const voice = (answers.voice as string) || 'assistant'

  // Upsert agent_profile
  const { error: profileErr } = await supabase
    .from('agent_profiles')
    .upsert(
      {
        user_id: user.id,
        agent_id: agent.id,
        display_name: displayName,
        voice,
        enabled: true,
        settings: answers,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,agent_id' }
    )
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  // Stamp the per-agent timestamp on profiles
  const col = TIMESTAMP_COL[agent.id]
  if (col) {
    await supabase
      .from('profiles')
      .update({ [col]: new Date().toISOString() })
      .eq('id', user.id)
  }

  // Persist each answer as a memory record tagged for this agent, so the
  // agent can read_memory and pick them up on first run.
  const rows = Object.entries(answers)
    .filter(([k]) => k !== 'display_name' && k !== 'voice')
    .map(([key, value]) => ({
      user_id: user.id,
      content: `${key}: ${Array.isArray(value) ? value.join(', ') : value}`,
      content_type: 'fact',
      domain: 'personal',
      tags: [`agent:${agent.id}`, 'onboarding', key],
      source: 'agent-onboarding',
      weight: 0.8,
      status: 'active',
      contradicts: [],
      expires_hint: null,
      life_stage: null,
      structured_data: { [key]: value },
    }))
  if (rows.length > 0) {
    await supabase.from('records').insert(rows)
  }

  return NextResponse.json({ ok: true, agent_id: agent.id, display_name: displayName, voice })
}
