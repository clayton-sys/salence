import type { MaintenanceTask } from '../types'
import { modelCall } from '@/lib/model-router'

interface Rec {
  id: string
  content: string
  content_type: string
  domain: string
  tags: string[]
  created_at: string
}

interface Cluster {
  kind: 'repeated_intent' | 'recurring_data' | 'temporal_rhythm'
  signature: string
  sampleContents: string[]
  count: number
  domains: string[]
}

interface Articulated {
  title: string
  description: string
  why_this_matters: string
  proposed_config: Record<string, unknown>
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'will',
  'what', 'when', 'where', 'about', 'would', 'could', 'should', 'like',
  'just', 'been', 'being', 'their', 'there', 'these', 'those', 'them',
])

function keywords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
}

function detectClusters(records: Rec[], existingAgentIds: Set<string>): Cluster[] {
  const clusters: Cluster[] = []

  // 1) Repeated intent — buckets of questions / conversation entries
  //    sharing strong keyword overlap.
  const questionRecs = records.filter(
    (r) => r.content_type === 'question' || r.content_type === 'conversation'
  )
  const byKeyword = new Map<string, Rec[]>()
  for (const r of questionRecs) {
    const kws = keywords(r.content).slice(0, 4)
    const key = kws.sort().join('|')
    if (!key) continue
    const bucket = byKeyword.get(key) || []
    bucket.push(r)
    byKeyword.set(key, bucket)
  }
  for (const [key, bucket] of byKeyword) {
    if (bucket.length >= 5) {
      const signature = key.split('|').slice(0, 3).join('/')
      if (existingAgentIds.has(signature)) continue
      clusters.push({
        kind: 'repeated_intent',
        signature,
        sampleContents: bucket.slice(0, 5).map((r) => r.content),
        count: bucket.length,
        domains: [...new Set(bucket.map((r) => r.domain))],
      })
    }
  }

  // 2) Recurring data — lots of records of the same content_type.
  const byType = new Map<string, Rec[]>()
  for (const r of records) {
    if (['conversation', 'question', 'fact'].includes(r.content_type)) continue
    const bucket = byType.get(r.content_type) || []
    bucket.push(r)
    byType.set(r.content_type, bucket)
  }
  for (const [type, bucket] of byType) {
    if (bucket.length >= 10) {
      clusters.push({
        kind: 'recurring_data',
        signature: type,
        sampleContents: bucket.slice(0, 5).map((r) => r.content),
        count: bucket.length,
        domains: [...new Set(bucket.map((r) => r.domain))],
      })
    }
  }

  // 3) Temporal rhythm — activity clustered by day-of-week.
  const byDow: number[] = new Array(7).fill(0)
  for (const r of records) {
    byDow[new Date(r.created_at).getDay()]++
  }
  const max = Math.max(...byDow)
  const total = byDow.reduce((a, b) => a + b, 0)
  if (total >= 30) {
    const top = byDow.indexOf(max)
    if (max > total * 0.3) {
      const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][top]
      clusters.push({
        kind: 'temporal_rhythm',
        signature: `dow:${dow}`,
        sampleContents: [],
        count: max,
        domains: [],
      })
    }
  }

  return clusters
}

export const patternFinder: MaintenanceTask = {
  id: 'pattern-finder',
  name: 'Pattern Finder',
  schedule: 'weekly',
  async run({ supabase, userId, now }) {
    if (now.getDay() !== 0) {
      return {
        records_affected: 0,
        cost_usd: 0,
        notes: 'not Sunday, skipping',
      }
    }

    const cutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const { data: rows } = await supabase
      .from('records')
      .select('id, content, content_type, domain, tags, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('created_at', cutoff)
    const records = (rows as Rec[]) || []

    // Filter out patterns already covered by active agent_profiles.
    const { data: profiles } = await supabase
      .from('agent_profiles')
      .select('agent_id')
      .eq('user_id', userId)
    const existingAgentIds = new Set(
      ((profiles as { agent_id: string }[]) || []).map((p) => p.agent_id)
    )

    const clusters = detectClusters(records, existingAgentIds).slice(0, 5)
    if (clusters.length === 0) {
      return {
        records_affected: 0,
        cost_usd: 0,
        notes: 'no patterns detected',
      }
    }

    // Articulation: one Haiku call per cluster, validated JSON.
    const articulated: Array<{ cluster: Cluster; art: Articulated }> = []
    for (const cluster of clusters) {
      const prompt = `Below is a cluster of related activity from a user. Articulate this as a suggested lightweight agent they might want — or, if the pattern is too weak, return null.

Cluster kind: ${cluster.kind}
Signature: ${cluster.signature}
Count: ${cluster.count}
Domains: ${cluster.domains.join(', ') || '(none)'}
Sample contents:
${cluster.sampleContents.slice(0, 5).map((c, i) => `${i + 1}. ${c.slice(0, 160)}`).join('\n')}

Return ONLY JSON of shape:
{
  "title": "<short phrase, <= 40 chars>",
  "description": "<one sentence describing what the agent would do>",
  "why_this_matters": "<one sentence tying it to the user's observed pattern>",
  "proposed_config": {
    "inputs": ["<string>"],
    "outputs": ["<string>"],
    "cadence": "<e.g. daily 06:00 local>"
  }
}

Or return the literal null if this pattern is too weak to justify an agent.`

      const raw = await modelCall({
        taskType: 'summarize_short',
        systemPrompt:
          'You are a pattern articulator. Be specific, concrete, and avoid generic output.',
        userMessage: prompt,
        logContext: { supabase, userId, agentId: 'maintenance:pattern-finder' },
      })

      let art: Articulated | null
      try {
        const cleaned = raw.replace(/```json|```/g, '').trim()
        if (cleaned.toLowerCase() === 'null') continue
        art = JSON.parse(cleaned) as Articulated
        if (!art?.title || !art?.description) continue
      } catch {
        continue
      }
      articulated.push({ cluster, art })
    }

    if (articulated.length === 0) {
      return { records_affected: 0, cost_usd: 0, notes: 'no suggestions articulated' }
    }

    // Cap at 3 active suggestions per user.
    const { count } = await supabase
      .from('suggestions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending')
    const existing = count || 0
    const room = Math.max(0, 3 - existing)
    const toWrite = articulated.slice(0, room)

    let written = 0
    for (const { cluster, art } of toWrite) {
      const { error } = await supabase.from('suggestions').insert({
        user_id: userId,
        kind: 'agent_suggestion',
        title: art.title,
        description: art.description,
        why_this_matters: art.why_this_matters || null,
        proposed_config: { cluster: cluster.signature, ...art.proposed_config },
        source_task: 'pattern-finder',
      })
      if (!error) written++
    }

    return {
      records_affected: written,
      cost_usd: 0,
      notes: `wrote ${written} suggestions (detected ${clusters.length} clusters)`,
    }
  },
}
