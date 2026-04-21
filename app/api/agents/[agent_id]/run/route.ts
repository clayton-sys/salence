import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { AGENTS } from '@/lib/agents/registry'
import { loadAgentContext, runAgent } from '@/lib/agents/runner'

export const runtime = 'nodejs'
export const maxDuration = 300 // agents can take a while

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
    return NextResponse.json({ error: `Unknown agent: ${agent_id}` }, { status: 404 })
  }

  let body: { message?: string } = {}
  try {
    body = await req.json()
  } catch {
    /* no body OK */
  }

  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const ctx = await loadAgentContext(supabase, user.id, agent)

  // Record run start
  const { data: runRow } = await supabase
    .from('agent_runs')
    .insert({
      user_id: user.id,
      agent_id: agent.id,
      result: {},
      trigger: 'user',
      status: 'running',
    })
    .select('id')
    .single()

  try {
    const result = await runAgent(ctx, agent, body.message)

    await supabase
      .from('agent_runs')
      .update({
        result: { tool_calls: result.tool_calls },
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
      content: result.content,
      summary: result.summary,
      tool_calls: result.tool_calls,
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
