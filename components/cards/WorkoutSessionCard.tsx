'use client'

import { useEffect, useRef, useState } from 'react'

interface LoggedSet {
  weight: string
  reps: string
  rpe: string
}

interface Exercise {
  name: string
  sets: number
  reps: string
  target_weight?: string
  rest_seconds?: number
  notes?: string
  logged_sets?: LoggedSet[]
}

interface FlashTarget {
  exerciseIndex: number
  setIndex: number
  at: number
}

interface Props {
  title: string
  date: string
  focus?: string
  estimated_minutes?: number
  exercises: Exercise[]
  toolUseId?: string
  flashTarget?: FlashTarget | null
}

function initialLog(exercises: Exercise[]): Record<number, LoggedSet[]> {
  const out: Record<number, LoggedSet[]> = {}
  exercises.forEach((ex, i) => {
    const count = Math.max(ex.sets || 0, ex.logged_sets?.length || 0)
    out[i] = Array.from({ length: count }, (_, si) => {
      const preset = ex.logged_sets?.[si]
      return {
        weight: preset?.weight ?? '',
        reps: preset?.reps ?? '',
        rpe: preset?.rpe ?? '',
      }
    })
  })
  return out
}

export function WorkoutSessionCard({
  title,
  date,
  focus,
  estimated_minutes,
  exercises,
  toolUseId,
  flashTarget,
}: Props) {
  const [log, setLog] = useState<Record<number, LoggedSet[]>>(() =>
    initialLog(exercises)
  )
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [flashingKey, setFlashingKey] = useState<string | null>(null)

  const rowRefs = useRef<Map<string, HTMLElement>>(new Map())

  // Prop-to-state sync at render time (React 19 idiom — avoids cascading
  // re-renders from useEffect). When the exercises prop identity changes
  // (e.g. a Haiku patch landed and the workspace re-fetched), re-seed
  // the log. Acceptable trade-off on single-device use: any in-flight
  // local edits get reset.
  const [prevExercises, setPrevExercises] = useState(exercises)
  if (exercises !== prevExercises) {
    setPrevExercises(exercises)
    setLog(initialLog(exercises))
  }

  // Flash-on-patch: latch flashingKey at render time when a new
  // flashTarget.at arrives. The effect below handles the async clear
  // and the scroll-into-view side effect.
  const [prevFlashAt, setPrevFlashAt] = useState<number | null>(
    flashTarget?.at ?? null
  )
  const incomingFlashAt = flashTarget?.at ?? null
  if (incomingFlashAt !== prevFlashAt) {
    setPrevFlashAt(incomingFlashAt)
    setFlashingKey(
      flashTarget
        ? `${flashTarget.exerciseIndex}-${flashTarget.setIndex}`
        : null
    )
  }

  useEffect(() => {
    if (!flashingKey) return
    const el = rowRefs.current.get(flashingKey)
    if (el) {
      const rect = el.getBoundingClientRect()
      const onScreen =
        rect.top >= 0 &&
        rect.bottom <=
          (window.innerHeight || document.documentElement.clientHeight)
      if (!onScreen) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
    const t = window.setTimeout(() => setFlashingKey(null), 800)
    return () => window.clearTimeout(t)
  }, [flashingKey])

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

  function registerRowRef(key: string, el: HTMLElement | null) {
    if (el) rowRefs.current.set(key, el)
    else rowRefs.current.delete(key)
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
            {(log[exIdx] || []).map((set, setIdx) => {
              const rowKey = `${exIdx}-${setIdx}`
              const flashing = flashingKey === rowKey
              return (
                <SetRow
                  key={setIdx}
                  index={setIdx + 1}
                  set={set}
                  flashing={flashing}
                  registerRef={(el) => registerRowRef(rowKey, el)}
                  onChange={(field, value) =>
                    updateSet(exIdx, setIdx, field, value)
                  }
                />
              )
            })}
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
  flashing,
  registerRef,
  onChange,
}: {
  index: number
  set: LoggedSet
  flashing: boolean
  registerRef: (el: HTMLElement | null) => void
  onChange: (field: keyof LoggedSet, value: string) => void
}) {
  const cellCls = `card-log-cell${flashing ? ' is-flashing' : ''}`
  return (
    <>
      <span
        className={`card-log-head ${cellCls}`}
        ref={registerRef}
      >
        {index}
      </span>
      <input
        className={cellCls}
        type="number"
        inputMode="decimal"
        value={set.weight}
        onChange={(e) => onChange('weight', e.target.value)}
        placeholder="—"
      />
      <input
        className={cellCls}
        type="number"
        inputMode="numeric"
        value={set.reps}
        onChange={(e) => onChange('reps', e.target.value)}
        placeholder="—"
      />
      <input
        className={cellCls}
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
