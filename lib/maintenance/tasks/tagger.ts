import type { MaintenanceTask } from '../types'
import { modelCall } from '@/lib/model-router'

interface Untagged {
  id: string
  content: string
  content_type: string
}

interface Ctx {
  slug: string
  label: string
}

interface TagOutput {
  id: string
  slug: string
}

const BATCH_SIZE = 20

export const tagger: MaintenanceTask = {
  id: 'tagger',
  name: 'Context Tagger',
  schedule: 'daily',
  async run({ supabase, userId }) {
    const { data: ctxRows } = await supabase
      .from('contexts')
      .select('slug, label')
      .eq('user_id', userId)
    const contexts = (ctxRows as Ctx[]) || []
    const customs = contexts.filter((c) => !['personal','work','health','family'].includes(c.slug))
    if (customs.length === 0) {
      return {
        records_affected: 0,
        cost_usd: 0,
        notes: 'no custom contexts — skipped',
      }
    }

    const contextList = contexts.map((c) => `${c.slug}: ${c.label}`).join('\n')

    // Find records with a default-looking domain that might actually fit a
    // custom context. We re-tag records whose domain is 'personal' (the
    // default extractor fallback).
    const { data: rows } = await supabase
      .from('records')
      .select('id, content, content_type')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('domain', 'personal')
      .order('created_at', { ascending: false })
      .limit(100)

    const candidates = (rows as Untagged[]) || []
    if (candidates.length === 0) {
      return {
        records_affected: 0,
        cost_usd: 0,
        notes: 'no untagged records',
      }
    }

    let affected = 0
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE)
      const inputList = batch
        .map((r, idx) => `${idx}. [id=${r.id}] (${r.content_type}) ${r.content.slice(0, 200)}`)
        .join('\n')

      const raw = await modelCall({
        taskType: 'tag',
        systemPrompt: `You assign a context slug to each record.

Available contexts:
${contextList}

Return ONLY a JSON array, one object per record in the input order:
[{"id": "<uuid>", "slug": "<slug from above>"}]

Only assign a custom context when you're highly confident it fits. If the record does not clearly belong to any non-default context (personal/work/health/family), omit it from the output — do not guess.`,
        userMessage: inputList,
        logContext: { userId, agentId: 'maintenance:tagger' },
      })

      let parsed: TagOutput[] = []
      try {
        const cleaned = raw.replace(/```json|```/g, '').trim()
        parsed = JSON.parse(cleaned)
        if (!Array.isArray(parsed)) parsed = []
      } catch {
        parsed = []
      }

      const validSlugs = new Set(contexts.map((c) => c.slug))
      for (const p of parsed) {
        if (!p.id || !p.slug) continue
        if (!validSlugs.has(p.slug)) continue
        const target = batch.find((b) => b.id === p.id)
        if (!target) continue
        const { error } = await supabase
          .from('records')
          .update({ domain: p.slug })
          .eq('id', p.id)
          .eq('user_id', userId)
        if (!error) affected++
      }
    }

    return {
      records_affected: affected,
      cost_usd: 0,
      notes: `tagged ${affected} of ${candidates.length} candidates`,
    }
  },
}
