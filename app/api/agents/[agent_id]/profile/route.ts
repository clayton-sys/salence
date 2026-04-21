import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { AGENTS } from '@/lib/agents/registry'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agent_id: string }> }
) {
  const { agent_id } = await params
  const agent = AGENTS[agent_id]
  if (!agent) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 404 })
  }
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }
  const { data } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .maybeSingle()
  return NextResponse.json({ profile: data })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agent_id: string }> }
) {
  const { agent_id } = await params
  const agent = AGENTS[agent_id]
  if (!agent) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 404 })
  }
  let body: {
    display_name?: string
    voice?: string
    enabled?: boolean
    settings?: Record<string, unknown>
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
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.display_name !== undefined) patch.display_name = body.display_name
  if (body.voice !== undefined) patch.voice = body.voice
  if (body.enabled !== undefined) patch.enabled = body.enabled
  if (body.settings !== undefined) patch.settings = body.settings

  const { data, error } = await supabase
    .from('agent_profiles')
    .upsert(
      {
        user_id: user.id,
        agent_id: agent.id,
        ...patch,
      },
      { onConflict: 'user_id,agent_id' }
    )
    .select('*')
    .single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ profile: data })
}
