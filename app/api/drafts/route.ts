import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let body: {
    draft_type: string
    content: Record<string, unknown>
    agent_id?: string
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

  const { data, error } = await supabase
    .from('drafts')
    .insert({
      user_id: user.id,
      draft_type: body.draft_type,
      agent_id: body.agent_id,
      content: body.content,
    })
    .select('id')
    .single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.id })
}
