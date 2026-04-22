'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/lib/profile-context'
import { AGENTS } from '@/lib/agents/registry'
import { ChatMessage } from '@/components/chat/ChatMessage'
import type { AssistantContentBlock, MemoryRecord } from '@/lib/types'

interface AgentRunRow {
  id: string
  agent_id: string
  ran_at: string
  status: string | null
  summary: string | null
  result: {
    tool_calls?: number
    blocks?: AssistantContentBlock[]
  } | null
}

interface ChatEntry {
  role: 'user' | 'assistant'
  content: string | AssistantContentBlock[]
  ts: number
  note?: string
}

export default function AgentWorkspace({
  params,
}: {
  params: Promise<{ agent_id: string }>
}) {
  const { agent_id } = use(params)
  const agent = AGENTS[agent_id]
  const { userId, profile, activeContextSlug } = useProfile()

  const [runs, setRuns] = useState<AgentRunRow[]>([])
  const [current, setCurrent] = useState<AgentRunRow | null>(null)
  const [latestSession, setLatestSession] = useState<MemoryRecord | null>(null)
  const [chat, setChat] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [running, setRunning] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<'chat' | 'artifact'>('artifact')
  const chatListRef = useRef<HTMLDivElement | null>(null)

  const loadRuns = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('agent_runs')
      .select('id, agent_id, ran_at, status, summary, result')
      .eq('user_id', userId)
      .eq('agent_id', agent_id)
      .eq('status', 'completed')
      .order('ran_at', { ascending: false })
      .limit(20)
    const rows = (data as AgentRunRow[]) || []
    setRuns(rows)
    if (rows[0]) setCurrent(rows[0])
  }, [userId, agent_id])

  const loadLatestSession = useCallback(async () => {
    if (!userId || agent_id !== 'coach') return
    const { data } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .eq('content_type', 'workout_session')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setLatestSession((data as MemoryRecord) || null)
  }, [userId, agent_id])

  useEffect(() => {
    loadRuns()
    loadLatestSession()
  }, [loadRuns, loadLatestSession])

  useEffect(() => {
    chatListRef.current?.scrollTo({
      top: chatListRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [chat, busy])

  if (!agent) {
    return (
      <section className="cortex-view">
        <p>
          Unknown agent. <Link href="/cortex">Back to Cortex</Link>
        </p>
      </section>
    )
  }

  const displayName = agent.default_display_name

  async function runFresh() {
    if (!userId || running) return
    setRunning(true)
    try {
      const res = await fetch(`/api/agents/${agent_id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok && data.content) {
        setChat((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.content,
            ts: Date.now(),
            note: 'fresh run',
          },
        ])
      }
      await loadRuns()
      await loadLatestSession()
    } finally {
      setRunning(false)
    }
  }

  async function sendChat() {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setChat((prev) => [
      ...prev,
      { role: 'user', content: text, ts: Date.now() },
    ])
    setBusy(true)
    try {
      const res = await fetch(`/api/agents/${agent_id}/workspace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context_slug: activeContextSlug,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Workspace call failed')

      if (data.kind === 'patch') {
        setChat((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.summary || 'Patch applied.',
            ts: Date.now(),
            note: `patched via ${data.tier}`,
          },
        ])
        await loadLatestSession()
        await loadRuns()
      } else {
        setChat((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.content || data.summary || '…',
            ts: Date.now(),
            note: 'full agent run',
          },
        ])
        await loadRuns()
        await loadLatestSession()
      }
    } catch (err) {
      setChat((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${(err as Error).message}`,
          ts: Date.now(),
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  const artifactBlocks: AssistantContentBlock[] | null = (() => {
    if (latestSession && agent_id === 'coach') {
      // Build a synthetic card_workout_session from the stored record so
      // the workspace artifact pane is always a live card.
      const d = latestSession.structured_data as {
        date?: string
        title?: string
        focus?: string
        exercises?: Array<{
          name: string
          sets: Array<{ weight: string; reps: string; rpe: string }>
          target_sets?: number
          target_reps?: string
          target_weight?: string
          notes?: string
        }>
      }
      return [
        {
          type: 'tool_use',
          id: latestSession.id,
          name: 'card_workout_session',
          input: {
            title: d.title || 'Workout',
            date: d.date || latestSession.created_at.slice(0, 10),
            focus: d.focus,
            exercises: (d.exercises || []).map((e) => ({
              name: e.name,
              sets: e.sets.length,
              reps: e.target_reps || '-',
              target_weight: e.target_weight,
              notes: e.notes,
              logged_sets: e.sets,
            })),
          },
        },
      ]
    }
    return current?.result?.blocks || null
  })()

  return (
    <section className="workspace-view">
      <header className="workspace-header">
        <div className="workspace-header-left">
          <Link href="/cortex" className="card-ghost">
            ← Cortex
          </Link>
          <h1>
            {agent.emoji} {displayName}
          </h1>
        </div>
        <div className="workspace-header-right">
          <button
            className="card-ghost"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            History ({runs.length})
          </button>
          <button
            className="card-primary"
            disabled={running}
            onClick={runFresh}
          >
            {running ? 'Running…' : 'Run now'}
          </button>
        </div>
      </header>

      <div className="workspace-mobile-tabs">
        <button
          className={`chat-context-chip${mobileTab === 'chat' ? ' is-active' : ''}`}
          onClick={() => setMobileTab('chat')}
        >
          Chat
        </button>
        <button
          className={`chat-context-chip${mobileTab === 'artifact' ? ' is-active' : ''}`}
          onClick={() => setMobileTab('artifact')}
        >
          Artifact
        </button>
      </div>

      <div className={`workspace-panes mobile-${mobileTab}`}>
        <aside className="workspace-chat-pane">
          <div className="workspace-chat-list" ref={chatListRef}>
            {chat.length === 0 && (
              <div className="chat-empty">
                <p className="chat-empty-text">
                  Talk to {displayName}. Messages update the artifact on the
                  right.
                </p>
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} className={`workspace-msg ${m.role}`}>
                <ChatMessage role={m.role} content={m.content} />
                {m.note && <span className="workspace-msg-note">{m.note}</span>}
              </div>
            ))}
            {busy && (
              <div className="chat-bubble chat-bubble-assistant">
                <span className="chat-typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
            )}
          </div>
          <form
            className="chat-input-row"
            onSubmit={(e) => {
              e.preventDefault()
              sendChat()
            }}
          >
            <textarea
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendChat()
                }
              }}
              rows={1}
              placeholder={`Message ${displayName}…`}
            />
            <button
              type="submit"
              className="chat-send"
              disabled={busy || !input.trim()}
              aria-label="Send"
            >
              ↑
            </button>
          </form>
        </aside>

        <section className="workspace-artifact-pane">
          {artifactBlocks ? (
            <ChatMessage role="assistant" content={artifactBlocks} />
          ) : (
            <div className="workspace-empty">
              <p>
                No artifact yet. Tap <strong>Run now</strong> to generate one,
                or message {displayName} on the left.
              </p>
            </div>
          )}
        </section>
      </div>

      {historyOpen && (
        <div className="workspace-history">
          <h3>History</h3>
          {runs.length === 0 && (
            <p className="memory-muted">No prior runs yet.</p>
          )}
          <ul>
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  className={`card-ghost${current?.id === r.id ? ' is-active' : ''}`}
                  onClick={() => {
                    setCurrent(r)
                    setHistoryOpen(false)
                  }}
                >
                  <span>{new Date(r.ran_at).toLocaleString()}</span>
                  {r.summary && (
                    <span className="workspace-history-summary">
                      {r.summary.slice(0, 80)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button
            className="card-ghost"
            onClick={() => setHistoryOpen(false)}
          >
            Close
          </button>
        </div>
      )}

      {!profile?.kitchen_onboarded_at &&
        !profile?.coach_onboarded_at &&
        !profile?.signal_onboarded_at &&
        !profile?.inbox_onboarded_at && null}
    </section>
  )
}
