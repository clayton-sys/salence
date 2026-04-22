'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/lib/profile-context'
import { AGENTS } from '@/lib/agents/registry'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { WorkoutSessionCard } from '@/components/cards/WorkoutSessionCard'
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
  id: string
  role: 'user' | 'assistant'
  content: string | AssistantContentBlock[]
  ts: number
  note?: string
}

interface FlashTarget {
  exerciseIndex: number
  setIndex: number
  at: number
}

interface WorkoutStructured {
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

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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
  const [mobileArtifactOpen, setMobileArtifactOpen] = useState(false)
  const [flashTarget, setFlashTarget] = useState<FlashTarget | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const chatListRef = useRef<HTMLDivElement | null>(null)
  const busyRef = useRef(false)

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
    if (rows[0]) {
      setCurrent(rows[0])
      setLastUpdatedAt(new Date(rows[0].ran_at).getTime())
    }
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
    const rec = (data as MemoryRecord) || null
    setLatestSession(rec)
    if (rec) {
      setLastUpdatedAt(new Date(rec.created_at).getTime())
    }
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
      if (res.ok && (data.summary || data.content)) {
        setChat((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content: data.summary || 'Run complete — see artifact.',
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
    if (!text || busyRef.current) return
    busyRef.current = true
    setInput('')
    setChat((prev) => [
      ...prev,
      { id: newId(), role: 'user', content: text, ts: Date.now() },
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
            id: newId(),
            role: 'assistant',
            content: data.summary || 'Patch applied.',
            ts: Date.now(),
            note: `patched via ${data.tier}`,
          },
        ])
        await loadLatestSession()
        await loadRuns()
        setLastUpdatedAt(Date.now())
        if (
          typeof data.exercise_index === 'number' &&
          typeof data.set_index === 'number'
        ) {
          setFlashTarget({
            exerciseIndex: data.exercise_index,
            setIndex: data.set_index,
            at: Date.now(),
          })
        }
      } else {
        // Non-patch: summary lives in chat, full blocks live in artifact (via
        // loadRuns → current). This avoids rendering the same content twice.
        setChat((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content: data.summary || 'Run complete — see artifact.',
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
          id: newId(),
          role: 'assistant',
          content: `Error: ${(err as Error).message}`,
          ts: Date.now(),
        },
      ])
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const workoutStruct: WorkoutStructured | null =
    latestSession && agent_id === 'coach'
      ? (latestSession.structured_data as WorkoutStructured)
      : null

  const nonCoachBlocks: AssistantContentBlock[] | null =
    agent_id !== 'coach' ? current?.result?.blocks || null : null

  const artifactTitle =
    agent_id === 'coach'
      ? workoutStruct?.title || 'Workout'
      : current?.summary?.slice(0, 60) || agent.default_display_name

  const lastUpdatedLabel =
    lastUpdatedAt != null ? formatRelative(lastUpdatedAt) : null

  const mobileSummary =
    agent_id === 'coach'
      ? workoutStruct?.focus ||
        (workoutStruct?.exercises?.length
          ? `${workoutStruct.exercises.length} exercises`
          : 'No workout yet')
      : current?.summary?.slice(0, 60) || 'No artifact yet'

  const artifactContent = (
    <>
      {agent_id === 'coach' && workoutStruct ? (
        <WorkoutSessionCard
          key={latestSession?.id ?? 'no-session'}
          title={workoutStruct.title || 'Workout'}
          date={workoutStruct.date || (latestSession?.created_at || '').slice(0, 10)}
          focus={workoutStruct.focus}
          exercises={(workoutStruct.exercises || []).map((e) => ({
            name: e.name,
            sets: e.sets.length,
            reps: e.target_reps || '-',
            target_weight: e.target_weight,
            notes: e.notes,
            logged_sets: e.sets,
          }))}
          flashTarget={flashTarget}
        />
      ) : nonCoachBlocks ? (
        <ChatMessage role="assistant" content={nonCoachBlocks} />
      ) : (
        <div className="workspace-empty">
          <p>
            No artifact yet. Tap <strong>Run now</strong> to generate one, or
            message {displayName} on the left.
          </p>
        </div>
      )}
    </>
  )

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

      <button
        type="button"
        className="workspace-mobile-peek"
        onClick={() => setMobileArtifactOpen(true)}
        aria-label="Open artifact"
      >
        <span className="workspace-mobile-peek-title">{artifactTitle}</span>
        <span className="workspace-mobile-peek-sub">{mobileSummary}</span>
      </button>

      <div className="workspace-panes">
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
            {chat.map((m) => (
              <div key={m.id} className={`workspace-msg ${m.role}`}>
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
          <header className="workspace-artifact-header">
            <h2 className="workspace-artifact-title">{artifactTitle}</h2>
            {lastUpdatedLabel && (
              <span className="workspace-artifact-stamp">
                Last updated {lastUpdatedLabel}
              </span>
            )}
          </header>
          <div className="workspace-artifact-body">{artifactContent}</div>
        </section>
      </div>

      {mobileArtifactOpen && (
        <div
          className="workspace-mobile-overlay"
          role="dialog"
          aria-label="Artifact"
        >
          <header className="workspace-artifact-header">
            <div>
              <h2 className="workspace-artifact-title">{artifactTitle}</h2>
              {lastUpdatedLabel && (
                <span className="workspace-artifact-stamp">
                  Last updated {lastUpdatedLabel}
                </span>
              )}
            </div>
            <button
              type="button"
              className="card-ghost"
              onClick={() => setMobileArtifactOpen(false)}
            >
              Close
            </button>
          </header>
          <div className="workspace-artifact-body">{artifactContent}</div>
        </div>
      )}

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

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 0) return 'just now'
  const s = Math.floor(diff / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}
