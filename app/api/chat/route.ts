import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import {
  modelCallFull,
  type ContentBlock,
  type ModelMessage,
} from '@/lib/model-router'
import { CARD_TOOLS } from '@/lib/cards'
import type { Domain, MemoryRecord } from '@/lib/types'

export const runtime = 'nodejs'

interface Attachment {
  kind: 'image' | 'document'
  media_type: string
  data: string // base64
  filename: string
}

interface ChatBody {
  message: string
  domain: Domain
  assistantName: string
  userName: string
  history: { role: 'user' | 'assistant'; content: string }[]
  attachment?: Attachment | null
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Server is missing ANTHROPIC_API_KEY.' },
      { status: 500 }
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
Keep responses conversational — this is a chat, not a report.

You may use Markdown formatting (headings, bold, lists, code blocks, tables, links) to make responses easier to read.

Rendering structured output:
When the user asks you to show them something structured — a meal plan, workout, shopping list, article brief, weekly review — call the matching card_* tool. Prefer cards over long prose for anything list- or table-shaped.

Never call send_email, create_calendar_event, delete_calendar_event, or delete_memory_record directly. Those require user confirmation — use card_confirm_action instead with the action_type and payload.`

  const history = (body.history || []).slice(-20)

  // Build messages — each history item is its own turn (not collapsed into
  // one user message) so the model can see the full back-and-forth.
  const messages: ModelMessage[] = []
  for (const h of history.slice(0, -1)) {
    messages.push({ role: h.role, content: h.content })
  }
  const att = body.attachment
  const latestBlocks: ContentBlock[] = []
  if (att) {
    if (att.kind === 'image') {
      latestBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: att.media_type,
          data: att.data,
        },
      })
    } else if (att.kind === 'document') {
      latestBlocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: att.data,
        },
      })
    }
  }
  latestBlocks.push({ type: 'text', text: body.message })
  messages.push({ role: 'user', content: latestBlocks })

  try {
    const result = await modelCallFull({
      taskType: 'chat',
      systemPrompt,
      messages,
      tools: CARD_TOOLS,
      maxTokens: 4096,
    })

    // Return the raw content blocks so the client renderer can mount cards.
    return NextResponse.json({
      content: result.content,
      stop_reason: result.stop_reason,
    })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Model call failed' },
      { status: 500 }
    )
  }
}
