import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { TOOLS } from '@/lib/tools'
import { TOOL_IMPLS } from '@/lib/tools/impls'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let body: { action_type: string; payload: Record<string, unknown> }
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

  const tool = TOOLS[body.action_type]
  if (!tool) {
    return NextResponse.json(
      { error: `Unknown action: ${body.action_type}` },
      { status: 400 }
    )
  }
  const impl = TOOL_IMPLS[body.action_type]
  if (!impl) {
    return NextResponse.json(
      { error: `Tool has no server implementation: ${body.action_type}` },
      { status: 501 }
    )
  }

  try {
    const result = await impl(
      { userId: user.id, supabase },
      body.payload || {}
    )
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
