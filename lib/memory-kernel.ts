import { supabase } from './supabase'
import { MemoryRecord, ContentType, Domain } from './types'

// `vector` is intentionally omitted in v1 — the column is pgvector-typed and
// rejects empty arrays ("vector must have at least 1 dimension"). It will be
// populated in v2 when similarity search ships.
export type NewRecord = Omit<
  MemoryRecord,
  'id' | 'created_at' | 'last_accessed' | 'vector'
>

export function makeRecord(params: {
  content: string
  contentType?: ContentType
  domain?: Domain
  tags?: string[]
  source?: string
  userId: string
}): NewRecord {
  return {
    user_id: params.userId,
    content: params.content,
    content_type: params.contentType || 'conversation',
    domain: params.domain || 'personal',
    tags: params.tags || [],
    source: params.source || 'chat',
    weight: 0.5,
    status: 'active',
    contradicts: [],
    expires_hint: null,
    life_stage: null,
    structured_data: {},
  }
}

export async function saveRecord(
  record: NewRecord
): Promise<MemoryRecord | null> {
  console.log('Save record attempt:', {
    user_id: record.user_id,
    domain: record.domain,
    content_type: record.content_type,
    content_preview: record.content.slice(0, 60),
  })

  if (!record.user_id) {
    console.error('Save record aborted: user_id is missing or falsy', {
      user_id: record.user_id,
    })
    return null
  }

  try {
    const { data, error } = await supabase
      .from('records')
      .insert(record)
      .select()
      .single()
    if (error) {
      console.error('Save record error:', JSON.stringify(error))
      console.error('Save record error (expanded):', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        user_id: record.user_id,
      })
      return null
    }
    return data as MemoryRecord
  } catch (err) {
    console.error('Save record exception:', JSON.stringify(err))
    console.error('Save record exception (raw):', err)
    return null
  }
}

export async function getRecentRecords(
  userId: string,
  limit = 20
): Promise<MemoryRecord[]> {
  try {
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      console.error('Get records error:', error)
      return []
    }
    return (data as MemoryRecord[]) || []
  } catch (err) {
    console.error('Get records exception:', err)
    return []
  }
}

export async function getRecordsByDomain(
  userId: string,
  domain: Domain,
  limit = 10
): Promise<MemoryRecord[]> {
  try {
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .eq('domain', domain)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      console.error('Get domain records error:', error)
      return []
    }
    return (data as MemoryRecord[]) || []
  } catch (err) {
    console.error('Get domain records exception:', err)
    return []
  }
}

export async function getContextForChat(
  userId: string,
  domain: Domain
): Promise<MemoryRecord[]> {
  // v1: recency-based retrieval
  // v2: replace with pgvector similarity search
  const domainRecords = await getRecordsByDomain(userId, domain, 6)
  const recentRecords = await getRecentRecords(userId, 6)
  const combined = [
    ...new Map(
      [...domainRecords, ...recentRecords].map((r) => [r.id, r])
    ).values(),
  ]
  return combined.slice(0, 10)
}

export async function expireRecord(id: string): Promise<void> {
  try {
    await supabase.from('records').update({ status: 'expired' }).eq('id', id)
  } catch (err) {
    console.error('Expire record exception:', err)
  }
}

export async function getAllRecords(
  userId: string
): Promise<MemoryRecord[]> {
  try {
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Get all records error:', error)
      return []
    }
    return (data as MemoryRecord[]) || []
  } catch (err) {
    console.error('Get all records exception:', err)
    return []
  }
}

export async function countActiveRecords(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')
    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}
