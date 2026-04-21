'use client'

import { useState } from 'react'
import { AGENTS } from '@/lib/agents/registry'
import type { AgentProfile } from '@/lib/agents/types'

interface Props {
  agentId: string
  agentProfile: AgentProfile
  onClose: () => void
  onSaved: () => void
}

export function AgentSettingsModal({
  agentId,
  agentProfile,
  onClose,
  onSaved,
}: Props) {
  const agent = AGENTS[agentId]
  const [displayName, setDisplayName] = useState(
    agentProfile.display_name || agent?.default_display_name || ''
  )
  const [voice, setVoice] = useState(agentProfile.voice || 'assistant')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!agent) return null

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName, voice }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            {agent.emoji} {agent.default_display_name} settings
          </h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          <label className="settings-label">Display name</label>
          <input
            className="settings-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <label className="settings-label">Voice</label>
          <div className="settings-domain-row">
            {agent.voices.map((v) => (
              <button
                key={v}
                type="button"
                className={`settings-chip${voice === v ? ' is-active' : ''}`}
                onClick={() => setVoice(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="settings-muted" style={{ marginTop: 14 }}>
            Cadence hint: {agent.cadence_hint}. V1 runs on demand only; cron
            scheduling ships in v2.
          </p>
          {error && (
            <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>
          )}
        </div>
        <div className="modal-foot">
          <button
            type="button"
            className="card-ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="card-primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
