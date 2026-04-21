'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/lib/profile-context'
import { AGENT_LIST } from '@/lib/agents/registry'
import type { AgentProfile } from '@/lib/agents/types'
import { AgentOnboardModal } from '@/components/agents/AgentOnboardModal'
import { AgentRunModal } from '@/components/agents/AgentRunModal'
import { AgentSettingsModal } from '@/components/agents/AgentSettingsModal'

interface Run {
  id: string
  agent_id: string
  ran_at: string
  status: string | null
  summary: string | null
  result: Record<string, unknown>
}

export default function CortexPage() {
  const { userId, profile } = useProfile()
  const router = useRouter()
  const [profiles, setProfiles] = useState<Record<string, AgentProfile>>({})
  const [runs, setRuns] = useState<Run[]>([])
  const [onboarding, setOnboarding] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const loadProfiles = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('agent_profiles')
      .select('*')
      .eq('user_id', userId)
    const map: Record<string, AgentProfile> = {}
    for (const p of data || []) map[p.agent_id] = p as AgentProfile
    setProfiles(map)
  }, [userId])

  const loadRuns = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('agent_runs')
      .select('id, agent_id, ran_at, status, summary, result')
      .eq('user_id', userId)
      .in(
        'agent_id',
        AGENT_LIST.map((a) => a.id)
      )
      .order('ran_at', { ascending: false })
      .limit(20)
    setRuns((data as Run[]) || [])
  }, [userId])

  useEffect(() => {
    if (!userId) return
    /* eslint-disable react-hooks/set-state-in-effect */
    loadProfiles()
    loadRuns()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [userId, loadProfiles, loadRuns])

  function isOnboarded(id: string): boolean {
    if (!profile) return false
    const key = (
      {
        'kitchen-steward': 'kitchen_onboarded_at',
        'inbox-triage': 'inbox_onboarded_at',
        coach: 'coach_onboarded_at',
        'signal-keeper': 'signal_onboarded_at',
      } as const
    )[id as 'kitchen-steward' | 'inbox-triage' | 'coach' | 'signal-keeper']
    if (!key) return false
    return !!profile[key as keyof typeof profile]
  }

  async function toggleEnabled(agentId: string, enabled: boolean) {
    await fetch(`/api/agents/${agentId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    loadProfiles()
  }

  function lastRunFor(id: string): string {
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
        {AGENT_LIST.map((agent) => {
          const agentProfile = profiles[agent.id]
          const onboarded = isOnboarded(agent.id)
          const displayName =
            agentProfile?.display_name || agent.default_display_name
          const enabled = agentProfile?.enabled ?? true
          return (
            <article
              key={agent.id}
              className={`cortex-agent-card${!enabled ? ' is-disabled' : ''}`}
            >
              <div className="cortex-agent-head">
                <div className="cortex-agent-emoji">{agent.emoji}</div>
                <div className="cortex-agent-body">
                  <h3>{displayName}</h3>
                  <p>{agent.description}</p>
                  <div className="cortex-agent-meta">
                    <span>last run: {lastRunFor(agent.id)}</span>
                    {agentProfile?.voice && <span>· voice: {agentProfile.voice}</span>}
                  </div>
                </div>
                {onboarded && (
                  <label className="cortex-toggle">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => toggleEnabled(agent.id, e.target.checked)}
                    />
                    <span />
                  </label>
                )}
              </div>
              <div className="cortex-agent-actions">
                {!onboarded ? (
                  <button
                    type="button"
                    className="card-primary"
                    onClick={() => setOnboarding(agent.id)}
                  >
                    Get started with {agent.default_display_name}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="card-primary"
                      disabled={!enabled || running === agent.id}
                      onClick={() => setRunning(agent.id)}
                    >
                      {running === agent.id ? 'Running…' : 'Run now'}
                    </button>
                    <button
                      type="button"
                      className="card-ghost"
                      onClick={() => setEditing(agent.id)}
                    >
                      Settings
                    </button>
                  </>
                )}
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
                {r.status || '—'}
                {r.summary ? ` · ${r.summary.slice(0, 80)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {onboarding && (
        <AgentOnboardModal
          agentId={onboarding}
          onClose={() => setOnboarding(null)}
          onDone={() => {
            setOnboarding(null)
            router.refresh()
            loadProfiles()
          }}
        />
      )}
      {running && (
        <AgentRunModal
          agentId={running}
          onClose={() => {
            setRunning(null)
            loadRuns()
          }}
        />
      )}
      {editing && profiles[editing] && (
        <AgentSettingsModal
          agentId={editing}
          agentProfile={profiles[editing]}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            loadProfiles()
          }}
        />
      )}
    </section>
  )
}
