'use client'

import { useCallback, useEffect, useState } from 'react'
import { AGENT_CONFIGS, getAgentRuns } from '@/lib/agents'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/lib/profile-context'

type Run = {
  id: string
  agent_id: string
  ran_at: string
  result: Record<string, unknown>
}

export default function CortexPage() {
  const { userId, profile, refreshProfile, refreshMemoryCount } = useProfile()
  const [runs, setRuns] = useState<Run[]>([])
  const [runningId, setRunningId] = useState<string | null>(null)

  const agentState =
    ((profile?.settings as Record<string, unknown>)?.agents as Record<
      string,
      boolean
    >) || {}

  const loadRuns = useCallback(async () => {
    if (!userId) return
    const rows = await getAgentRuns(userId, 10)
    setRuns(rows as Run[])
  }, [userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRuns()
  }, [loadRuns])

  function isActive(id: string) {
    const cfg = AGENT_CONFIGS.find((a) => a.id === id)
    if (id in agentState) return agentState[id]
    return cfg?.active ?? false
  }

  async function toggle(id: string) {
    if (!userId) return
    const nextState: Record<string, boolean> = { ...agentState, [id]: !isActive(id) }
    const nextSettings = {
      ...(profile?.settings || {}),
      agents: nextState,
    }
    await supabase
      .from('profiles')
      .update({ settings: nextSettings })
      .eq('id', userId)
    await refreshProfile()
  }

  async function runNow(id: string) {
    if (!userId) return
    const apiKey = localStorage.getItem('salence_api_key') || ''
    if (!apiKey) {
      alert('Add your API key in Settings first.')
      return
    }
    setRunningId(id)
    try {
      if (id === 'fact_extractor') {
        const rec = await supabase
          .from('records')
          .select('content, domain')
          .eq('user_id', userId)
          .eq('source', 'chat')
          .eq('content_type', 'conversation')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (rec.data) {
          await fetch('/api/agents/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: rec.data.content,
              domain: rec.data.domain,
              userId,
              apiKey,
            }),
          })
        }
      } else if (id === 'expiry_watcher') {
        await fetch('/api/agents/expiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, apiKey }),
        })
      }
      await loadRuns()
      await refreshMemoryCount()
    } finally {
      setRunningId(null)
    }
  }

  function lastRun(id: string) {
    const r = runs.find((x) => x.agent_id === id)
    return r ? new Date(r.ran_at).toLocaleString() : 'never'
  }

  return (
    <section className="cortex-view">
      <header className="cortex-header">
        <h1>Cortex</h1>
        <p className="cortex-sub">Your agents</p>
      </header>

      <div className="cortex-grid">
        {AGENT_CONFIGS.map((a) => {
          const active = isActive(a.id)
          return (
            <article key={a.id} className="cortex-card">
              <div className="cortex-card-head">
                <span className="cortex-emoji">{a.emoji}</span>
                <div>
                  <h3>{a.label}</h3>
                  <p>{a.description}</p>
                </div>
                <label className="cortex-toggle">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggle(a.id)}
                  />
                  <span />
                </label>
              </div>
              <div className="cortex-card-foot">
                <span className="cortex-last">Last run: {lastRun(a.id)}</span>
                <button
                  className="cortex-run"
                  disabled={runningId === a.id}
                  onClick={() => runNow(a.id)}
                >
                  {runningId === a.id ? 'Running…' : 'Run now'}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <section className="cortex-log">
        <h2>Activity</h2>
        {runs.length === 0 && <p className="cortex-muted">No runs yet.</p>}
        <ul>
          {runs.map((r) => (
            <li key={r.id}>
              <span className="cortex-log-agent">{r.agent_id}</span>
              <span className="cortex-log-time">
                {new Date(r.ran_at).toLocaleString()}
              </span>
              <span className="cortex-log-result">
                {JSON.stringify(r.result)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}
