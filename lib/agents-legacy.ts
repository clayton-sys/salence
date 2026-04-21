import { modelCall } from './model-router'
import {
  saveRecord,
  makeRecord,
  getRecentRecords,
  expireRecord,
} from './memory-kernel'
import { supabase } from './supabase'
import type { AgentConfig, ContentType, Domain } from './types'

export const AGENT_CONFIGS: AgentConfig[] = [
  {
    id: 'fact_extractor',
    label: 'Fact Extractor',
    emoji: '🔍',
    description: 'Pulls key facts from conversations automatically',
    active: true,
  },
  {
    id: 'expiry_watcher',
    label: 'Memory Watcher',
    emoji: '👁',
    description: 'Checks if stored context might be outdated',
    active: true,
  },
  {
    id: 'contradiction_flag',
    label: 'Contradiction Detector',
    emoji: '⚡',
    description: 'Notices when new info conflicts with memory',
    active: false,
  },
]

async function logAgentRun(
  userId: string,
  agentId: string,
  result: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('agent_runs').insert({
      user_id: userId,
      agent_id: agentId,
      result,
    })
  } catch {
    /* non-blocking */
  }
}

export async function runFactExtractor(
  message: string,
  domain: Domain,
  userId: string
): Promise<{ extracted: number }> {
  try {
    const raw = await modelCall({
      taskType: 'extract_facts',
      systemPrompt: `Extract key personal facts from this message. Reply ONLY with a JSON array: [{fact: string, contentType: string, tags: string[]}]. Content types: fact | decision | question | health | family | work. Return [] if no clear facts. Keep facts concise and specific.`,
      userMessage: message,
    })
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const facts = JSON.parse(cleaned)
    if (!Array.isArray(facts)) {
      await logAgentRun(userId, 'fact_extractor', { extracted: 0 })
      return { extracted: 0 }
    }
    for (const f of facts) {
      await saveRecord(
        makeRecord({
          content: f.fact,
          contentType: (f.contentType as ContentType) || 'fact',
          domain,
          tags: Array.isArray(f.tags) ? f.tags : [],
          source: 'agent',
          userId,
        })
      )
    }
    await logAgentRun(userId, 'fact_extractor', { extracted: facts.length })
    return { extracted: facts.length }
  } catch {
    await logAgentRun(userId, 'fact_extractor', { extracted: 0, error: true })
    return { extracted: 0 }
  }
}

export async function runExpiryWatcher(
  userId: string
): Promise<{ flagged: number }> {
  const records = await getRecentRecords(userId, 50)
  const old = records
    .filter((r) => {
      const ageDays =
        (Date.now() - new Date(r.created_at).getTime()) / 86400000
      return ageDays > 30
    })
    .slice(0, 5)
  if (!old.length) {
    await logAgentRun(userId, 'expiry_watcher', { flagged: 0 })
    return { flagged: 0 }
  }
  let flagged = 0
  for (const record of old) {
    try {
      const raw = await modelCall({
        taskType: 'decay_check',
        systemPrompt: `Is this memory still likely relevant to someone's life? Reply ONLY with JSON: {stillRelevant: boolean, reason: string}`,
        userMessage: `Memory: "${record.content}" (created ${record.created_at})`,
      })
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const result = JSON.parse(cleaned)
      if (!result.stillRelevant) {
        await expireRecord(record.id)
        flagged++
      }
    } catch {
      /* skip this record */
    }
  }
  await logAgentRun(userId, 'expiry_watcher', { flagged })
  return { flagged }
}

export async function getAgentRuns(userId: string, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('user_id', userId)
      .order('ran_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return data || []
  } catch {
    return []
  }
}
