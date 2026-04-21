'use client'

import { useState } from 'react'

interface Props {
  action_type: string
  summary: string
  payload: Record<string, unknown>
}

const LABELS: Record<string, string> = {
  send_email: 'Send email',
  create_calendar_event: 'Create calendar event',
  delete_calendar_event: 'Delete calendar event',
  delete_memory_record: 'Delete memory record',
}

export function ConfirmActionCard({ action_type, summary, payload }: Props) {
  const [state, setState] = useState<'pending' | 'running' | 'done' | 'error'>(
    'pending'
  )
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setState('running')
    setError(null)
    try {
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type, payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to execute')
      setState('done')
    } catch (err) {
      setError((err as Error).message)
      setState('error')
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">{LABELS[action_type] || action_type}</h3>
        <span className="card-subtitle">requires confirmation</span>
      </div>
      <div className="card-confirm-summary">{summary}</div>
      {state === 'error' && error && (
        <p style={{ color: 'var(--danger)', fontSize: 13, margin: '8px 0 0' }}>
          {error}
        </p>
      )}
      {state === 'done' && (
        <p
          style={{
            color: 'var(--accent)',
            fontSize: 13,
            margin: '8px 0 0',
          }}
        >
          ✓ Done
        </p>
      )}
      {(state === 'pending' || state === 'error') && (
        <div className="card-footer">
          <button
            type="button"
            className="card-primary"
            onClick={confirm}
          >
            Confirm
          </button>
          <button
            type="button"
            className="card-ghost"
            onClick={() => setState('done')}
          >
            Cancel
          </button>
        </div>
      )}
      {state === 'running' && (
        <div className="card-footer">
          <div className="card-tool-running">
            <span className="dot" />
            Executing…
          </div>
        </div>
      )}
    </div>
  )
}
