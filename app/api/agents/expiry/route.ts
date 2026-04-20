import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { modelCall } from '@/lib/model-router'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let body: { userId: string; apiKey: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.apiKey) {
    return NextResponse.json({ flagged: 0, skipped: 'no-key' })
  }

  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== body.userId) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { data } = await supabase
    .from('records')
    .select('id, content, created_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50)

  const old = (data || [])
    .filter((r) => {
      const age = (Date.now() - new Date(r.created_at).getTime()) / 86400000
      return age > 30
    })
    .slice(0, 5)

  if (!old.length) {
    await supabase.from('agent_runs').insert({
      user_id: user.id,
      agent_id: 'expiry_watcher',
      result: { flagged: 0 },
    })
    return NextResponse.json({ flagged: 0 })
  }

  let flagged = 0
  for (const record of old) {
    try {
      const raw = await modelCall({
        taskType: 'decay_check',
        apiKey: body.apiKey,
        systemPrompt: `Is this memory still likely relevant to someone's life? Reply ONLY with JSON: {stillRelevant: boolean, reason: string}`,
        userMessage: `Memory: "${record.content}" (created ${record.created_at})`,
      })
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const result = JSON.parse(cleaned)
      if (!result.stillRelevant) {
        await supabase
          .from('records')
          .update({ status: 'expired' })
          .eq('id', record.id)
        flagged++
      }
    } catch {
      /* skip */
    }
  }

  await supabase.from('agent_runs').insert({
    user_id: user.id,
    agent_id: 'expiry_watcher',
    result: { flagged },
  })

  return NextResponse.json({ flagged })
}
