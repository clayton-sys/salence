import type { MaintenanceTask } from '../types'

interface RecordLite {
  id: string
  content: string
  created_at: string
  domain: string
  content_type: string
}

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

// Trigram-ish similarity using token overlap. Cheap and good enough to
// catch near-duplicates produced by the extractor across close-in-time
// user messages.
function similarity(a: string, b: string): number {
  const toks = (s: string) => new Set(s.split(/\s+/).filter((t) => t.length > 2))
  const A = toks(normalize(a))
  const B = toks(normalize(b))
  if (A.size === 0 || B.size === 0) return 0
  let shared = 0
  for (const t of A) if (B.has(t)) shared++
  return shared / Math.max(A.size, B.size)
}

export const deduplicator: MaintenanceTask = {
  id: 'deduplicator',
  name: 'Deduplicator',
  schedule: 'daily',
  async run({ supabase, userId }) {
    // Pull the most recent ~500 active records. Enough to catch fresh
    // duplicates without scanning the whole table.
    const { data } = await supabase
      .from('records')
      .select('id, content, created_at, domain, content_type')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(500)
    const records = (data as RecordLite[]) || []
    if (records.length === 0) {
      return { records_affected: 0, cost_usd: 0, notes: 'no records' }
    }

    const byContent = new Map<string, RecordLite[]>()
    for (const r of records) {
      const key = `${r.domain}:${r.content_type}:${normalize(r.content)}`
      const bucket = byContent.get(key) || []
      bucket.push(r)
      byContent.set(key, bucket)
    }

    const exactDupeIds: string[] = []
    for (const bucket of byContent.values()) {
      if (bucket.length < 2) continue
      bucket.sort((a, b) => a.created_at.localeCompare(b.created_at))
      for (const r of bucket.slice(1)) exactDupeIds.push(r.id)
    }

    const seenExact = new Set(exactDupeIds)
    const nearDupeIds: string[] = []
    for (let i = 0; i < records.length; i++) {
      const a = records[i]
      if (seenExact.has(a.id)) continue
      for (let j = i + 1; j < records.length; j++) {
        const b = records[j]
        if (seenExact.has(b.id)) continue
        if (a.domain !== b.domain || a.content_type !== b.content_type) continue
        if (similarity(a.content, b.content) >= 0.95) {
          const loser = a.content.length >= b.content.length ? b.id : a.id
          nearDupeIds.push(loser)
        }
      }
    }

    const toDelete = [...new Set([...exactDupeIds, ...nearDupeIds])]
    if (toDelete.length === 0) {
      return { records_affected: 0, cost_usd: 0, notes: 'no duplicates' }
    }

    await supabase
      .from('records')
      .delete()
      .in('id', toDelete)
      .eq('user_id', userId)

    return {
      records_affected: toDelete.length,
      cost_usd: 0,
      notes: `removed ${exactDupeIds.length} exact + ${nearDupeIds.length} near dupes`,
    }
  },
}
