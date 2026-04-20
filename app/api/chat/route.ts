import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { modelCall } from '@/lib/model-router'
import type { Domain, MemoryRecord } from '@/lib/types'

export const runtime = 'nodejs'

interface ChatBody {
  message: string
  domain: Domain
  assistantName: string
  userName: string
  history: { role: 'user' | 'assistant'; content: string }[]
}

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-salence-api-key') || ''
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing API key. Set one in Settings.' },
      { status: 400 }
    )
  }

  let body: ChatBody
  try {
    body = (await req.json()) as ChatBody
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

  // Fetch context: domain records + recent records, dedup, cap at 10
  const [{ data: domainRows }, { data: recentRows }] = await Promise.all([
    supabase
      .from('records')
      .select('*')
      .eq('user_id', user.id)
      .eq('domain', body.domain)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('records')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const combined = [
    ...new Map(
      [...(domainRows || []), ...(recentRows || [])].map((r: MemoryRecord) => [
        r.id,
        r,
      ])
    ).values(),
  ].slice(0, 10)

  const contextLines = combined
    .map((r) => `- [${r.content_type}] ${r.content}`)
    .join('\n')

  const systemPrompt = `You are ${body.assistantName}, a warm and intelligent personal AI assistant.
You remember things about this person and use that knowledge naturally — like a trusted friend who actually pays attention.

User's name: ${body.userName}
Current context: ${body.domain}

What you know about this person:
${contextLines || '(nothing yet — this is your first exchange)'}

Be warm, conversational, and genuinely helpful.
Reference what you know naturally when relevant.
If something seems outdated, gently flag it.
Keep responses conversational — this is a chat, not a report.`

  // Fold prior history into the user message since modelCall sends one user turn.
  const history = (body.history || []).slice(-20)
  const transcriptBlock = history
    .map((m) => `${m.role === 'user' ? body.userName : body.assistantName}: ${m.content}`)
    .join('\n')

  const userMessage = transcriptBlock
    ? `Prior exchange:\n${transcriptBlock}\n\nRespond to the latest message from ${body.userName}.`
    : body.message

  try {
    const reply = await modelCall({
      taskType: 'chat',
      apiKey,
      systemPrompt,
      userMessage,
    })
    return NextResponse.json({ reply })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Model call failed' },
      { status: 500 }
    )
  }
}
