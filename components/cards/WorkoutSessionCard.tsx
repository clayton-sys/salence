'use client'

import { useState } from 'react'

interface Exercise {
  name: string
  sets: number
  reps: string
  target_weight?: string
  rest_seconds?: number
  notes?: string
}

interface Props {
  title: string
  date: string
  focus?: string
  estimated_minutes?: number
  exercises: Exercise[]
  toolUseId?: string
}

interface LoggedSet {
  weight: string
  reps: string
  rpe: string
}

export function WorkoutSessionCard({
  title,
  date,
  focus,
  estimated_minutes,
  exercises,
  toolUseId,
}: Props) {
  const [log, setLog] = useState<Record<number, LoggedSet[]>>(() => {
    const initial: Record<number, LoggedSet[]> = {}
    exercises.forEach((ex, i) => {
      initial[i] = Array.from({ length: ex.sets }, () => ({
        weight: '',
        reps: '',
        rpe: '',
      }))
    })
    return initial
  })
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function logSession() {
    setSaving(true)
    try {
      const payload = {
        tool_use_id: toolUseId,
        date,
        title,
        focus,
        exercises: exercises.map((ex, i) => ({
          name: ex.name,
          target_sets: ex.sets,
          target_reps: ex.reps,
          target_weight: ex.target_weight,
          sets: log[i] || [],
          notes: notes[i] || '',
        })),
      }
      await fetch('/api/agents/coach/log-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  function updateSet(
    exIdx: number,
    setIdx: number,
    field: keyof LoggedSet,
    value: string
  ) {
    setLog((prev) => {
      const next = { ...prev }
      const arr = [...(next[exIdx] || [])]
      arr[setIdx] = { ...arr[setIdx], [field]: value }
      next[exIdx] = arr
      return next
    })
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">{title}</h3>
        <span className="card-subtitle">
          {date}
          {focus ? ` · ${focus}` : ''}
          {estimated_minutes ? ` · ~${estimated_minutes}m` : ''}
        </span>
      </div>

      {exercises.map((ex, exIdx) => (
        <div key={exIdx} className="card-section">
          <div className="card-row">
            <div className="card-row-main">
              <div className="card-row-title">{ex.name}</div>
              <div className="card-row-sub">
                {ex.sets} × {ex.reps}
                {ex.target_weight ? ` @ ${ex.target_weight}` : ''}
                {ex.rest_seconds ? ` · rest ${ex.rest_seconds}s` : ''}
              </div>
              {ex.notes && (
                <div className="card-row-sub" style={{ fontStyle: 'italic' }}>
                  {ex.notes}
                </div>
              )}
            </div>
          </div>

          <div className="card-log-grid" style={{ marginTop: 8 }}>
            <span className="card-log-head">Set</span>
            <span className="card-log-head">Weight</span>
            <span className="card-log-head">Reps</span>
            <span className="card-log-head">RPE</span>
            {(log[exIdx] || []).map((set, setIdx) => (
              <SetRow
                key={setIdx}
                index={setIdx + 1}
                set={set}
                onChange={(field, value) =>
                  updateSet(exIdx, setIdx, field, value)
                }
              />
            ))}
          </div>
          <textarea
            className="card-notes"
            placeholder="Notes (optional)"
            value={notes[exIdx] || ''}
            onChange={(e) =>
              setNotes((prev) => ({ ...prev, [exIdx]: e.target.value }))
            }
          />
        </div>
      ))}

      <div className="card-footer">
        <button
          type="button"
          className="card-primary"
          onClick={logSession}
          disabled={saving || saved}
        >
          {saved ? '✓ Session logged' : saving ? 'Logging…' : 'Log session'}
        </button>
      </div>
    </div>
  )
}

function SetRow({
  index,
  set,
  onChange,
}: {
  index: number
  set: LoggedSet
  onChange: (field: keyof LoggedSet, value: string) => void
}) {
  return (
    <>
      <span className="card-log-head">{index}</span>
      <input
        type="number"
        inputMode="decimal"
        value={set.weight}
        onChange={(e) => onChange('weight', e.target.value)}
        placeholder="—"
      />
      <input
        type="number"
        inputMode="numeric"
        value={set.reps}
        onChange={(e) => onChange('reps', e.target.value)}
        placeholder="—"
      />
      <input
        type="number"
        inputMode="decimal"
        min="1"
        max="10"
        value={set.rpe}
        onChange={(e) => onChange('rpe', e.target.value)}
        placeholder="—"
      />
    </>
  )
}
