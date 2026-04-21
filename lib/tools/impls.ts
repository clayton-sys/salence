// Server-side implementations for tools declared in lib/tools.ts.
// Each fn takes (userId, input) and returns a JSON-serializable result.
// Executor stringifies the result for the tool_result block.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ToolContext {
  userId: string
  supabase: SupabaseClient
}

// ────── memory ──────────────────────────────────────────────
export async function read_memory(
  ctx: ToolContext,
  input: {
    domain?: string
    tag?: string
    content_type?: string
    limit?: number
    query_contains?: string
  }
) {
  let query = ctx.supabase
    .from('records')
    .select('id, content, content_type, domain, tags, created_at')
    .eq('user_id', ctx.userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 20)
  if (input.domain) query = query.eq('domain', input.domain)
  if (input.content_type) query = query.eq('content_type', input.content_type)
  if (input.tag) query = query.contains('tags', [input.tag])
  if (input.query_contains)
    query = query.ilike('content', `%${input.query_contains}%`)
  const { data, error } = await query
  if (error) return { error: error.message }
  return { records: data || [] }
}

export async function write_memory(
  ctx: ToolContext,
  input: {
    content: string
    content_type?: string
    domain?: string
    tags?: string[]
    structured_data?: Record<string, unknown>
  }
) {
  const { data, error } = await ctx.supabase
    .from('records')
    .insert({
      user_id: ctx.userId,
      content: input.content,
      content_type: input.content_type || 'fact',
      domain: input.domain || 'personal',
      tags: input.tags || [],
      source: 'agent',
      weight: 0.5,
      status: 'active',
      contradicts: [],
      expires_hint: null,
      life_stage: null,
      structured_data: input.structured_data || {},
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export async function delete_memory_record(
  ctx: ToolContext,
  input: { record_id: string }
) {
  const { error } = await ctx.supabase
    .from('records')
    .delete()
    .eq('id', input.record_id)
    .eq('user_id', ctx.userId)
  if (error) return { error: error.message }
  return { deleted: true }
}

// ────── web ─────────────────────────────────────────────────

interface SearchResult {
  title: string
  url: string
  snippet: string
}

export async function search_web(
  _ctx: ToolContext,
  input: { query: string; max_results?: number }
) {
  // DuckDuckGo Instant Answer isn't great for general queries, but the
  // HTML endpoint at duckduckgo.com/html/ works without an API key.
  // For production, swap in a Brave / Serper / Tavily key.
  try {
    const res = await fetch(
      `https://duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; SalenceBot/1.0; +https://salence.app)',
        },
      }
    )
    const html = await res.text()
    const results: SearchResult[] = []
    // Crude regex parse — sufficient for a rough snippet extraction.
    const re =
      /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
    let m: RegExpExecArray | null
    const max = input.max_results ?? 8
    while ((m = re.exec(html)) !== null && results.length < max) {
      const url = decodeURIComponent(m[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '').split('&')[0])
      const title = stripTags(m[2]).trim()
      const snippet = stripTags(m[3]).trim()
      if (url && title) results.push({ title, url, snippet })
    }
    return { results }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

export async function scrape_url(
  _ctx: ToolContext,
  input: { url: string; max_chars?: number }
) {
  try {
    const res = await fetch(input.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SalenceBot/1.0; +https://salence.app)',
      },
    })
    if (!res.ok) return { error: `HTTP ${res.status}` }
    const html = await res.text()
    const text = stripTags(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<header[\s\S]*?<\/header>/gi, ' ')
        .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    )
      .replace(/\s+/g, ' ')
      .trim()
    const max = input.max_chars ?? 8000
    return {
      url: input.url,
      text: text.slice(0, max),
      truncated: text.length > max,
    }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
}

// ────── drafts ──────────────────────────────────────────────
export async function draft_email(
  ctx: ToolContext,
  input: { thread_id?: string; to: string; subject: string; body: string }
) {
  const { data, error } = await ctx.supabase
    .from('drafts')
    .insert({
      user_id: ctx.userId,
      draft_type: 'email',
      agent_id: 'inbox-triage',
      content: {
        thread_id: input.thread_id,
        to: input.to,
        subject: input.subject,
        body: input.body,
      },
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { draft_id: data.id }
}

// ────── Gmail / Calendar stubs ──────────────────────────────
// Real OAuth wiring lands in v2. For now these return a friendly explanation
// so the model's plan degrades gracefully and the UI doesn't break.
export async function list_gmail_threads() {
  return {
    error:
      "Gmail isn't connected yet. Ask the user to connect Gmail in Settings once that flow ships.",
    connected: false,
  }
}
export async function read_gmail_thread() {
  return { error: 'Gmail not connected', connected: false }
}
export async function list_calendar_events() {
  return { error: 'Calendar not connected', connected: false }
}
export async function send_email() {
  return { error: 'Gmail not connected', connected: false }
}
export async function create_calendar_event() {
  return { error: 'Calendar not connected', connected: false }
}
export async function delete_calendar_event() {
  return { error: 'Calendar not connected', connected: false }
}

// ────── registry ────────────────────────────────────────────

export type ToolImpl = (
  ctx: ToolContext,
  input: Record<string, unknown>
) => Promise<unknown>

/* eslint-disable @typescript-eslint/no-explicit-any */
export const TOOL_IMPLS: Record<string, ToolImpl> = {
  read_memory: read_memory as any,
  write_memory: write_memory as any,
  delete_memory_record: delete_memory_record as any,
  search_web: search_web as any,
  scrape_url: scrape_url as any,
  draft_email: draft_email as any,
  list_gmail_threads: list_gmail_threads as any,
  read_gmail_thread: read_gmail_thread as any,
  list_calendar_events: list_calendar_events as any,
  send_email: send_email as any,
  create_calendar_event: create_calendar_event as any,
  delete_calendar_event: delete_calendar_event as any,
}
/* eslint-enable @typescript-eslint/no-explicit-any */
