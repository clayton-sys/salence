import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { modelCall } from '@/lib/model-router'
import type { ContentType, Domain } from '@/lib/types'

export const runtime = 'nodejs'

interface ExtractBody {
  message: string
  domain: Domain
  context_slug?: string | null
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ extracted: 0, skipped: 'no-server-key' })
  }

  let body: ExtractBody
  try {
    body = (await req.json()) as ExtractBody
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

  try {
    const raw = await modelCall({
      taskType: 'extract',
      systemPrompt: `Extract key personal facts from this message. Reply ONLY with a JSON array: [{fact: string, contentType: string, tags: string[]}]. Content types: fact | decision | question | health | family | work | note. If the user's message starts with "remember that", "save this as a note", "note for X:", "note:", "jot down", or similar, treat the stated content as contentType "note". Return [] if no clear facts. Keep facts concise and specific.`,
      userMessage: body.message,
      logContext: { supabase, userId: user.id, agentId: 'fact_extractor' },
    })
    const cleaned = raw.replace(/```json|```/g, '').trim()
    let facts: Array<{ fact: string; contentType?: ContentType; tags?: string[] }> = []
    try {
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) facts = parsed
    } catch {
      facts = []
    }

    const effectiveDomain = (body.context_slug || body.domain) as string

    for (const f of facts) {
      if (!f.fact) continue
      await supabase.from('records').insert({
        user_id: user.id,
        content: f.fact,
        content_type: (f.contentType as ContentType) || 'fact',
        domain: effectiveDomain,
        tags: Array.isArray(f.tags) ? f.tags : [],
        source: 'agent',
        weight: 0.5,
        status: 'active',
        contradicts: [],
        expires_hint: null,
        life_stage: null,
        structured_data: {},
      })
    }

    await supabase.from('agent_runs').insert({
      user_id: user.id,
      agent_id: 'fact_extractor',
      result: { extracted: facts.length },
    })

    return NextResponse.json({ extracted: facts.length })
  } catch (err) {
    await supabase.from('agent_runs').insert({
      user_id: user.id,
      agent_id: 'fact_extractor',
      result: { extracted: 0, error: (err as Error).message },
    })
    return NextResponse.json({ extracted: 0, error: (err as Error).message })
  }
}
