'use client'

import { useState } from 'react'
import { AGENTS } from '@/lib/agents/registry'

interface Props {
  agentId: string
  onClose: () => void
  onDone: () => void
}

type AnswerMap = Record<string, string | string[] | number>

export function AgentOnboardModal({ agentId, onClose, onDone }: Props) {
  const agent = AGENTS[agentId]
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!agent) return null
  const total = agent.first_run_questions.length
  const q = agent.first_run_questions[step]
  const answer = answers[q.id]

  function setAnswer(v: string | string[] | number) {
    setAnswers((prev) => ({ ...prev, [q.id]: v }))
  }

  function toggleMulti(v: string) {
    const curr = (answers[q.id] as string[]) || []
    if (curr.includes(v)) {
      setAnswer(curr.filter((x) => x !== v))
    } else {
      setAnswer([...curr, v])
    }
  }

  async function finish() {
    setSaving(true)
    setError(null)
    try {
      // Default-fill missing display_name/voice
      const final: AnswerMap = { ...answers }
      if (!final.display_name) final.display_name = agent.default_display_name
      if (!final.voice) final.voice = agent.voices[0]
      const res = await fetch(`/api/agents/${agent.id}/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: final }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Onboard failed')
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function next() {
    if (step < total - 1) setStep(step + 1)
    else finish()
  }

  const canAdvance =
    q.type === 'multi_select'
      ? Array.isArray(answer) && answer.length > 0
      : q.type === 'number'
        ? typeof answer === 'number' || (typeof answer === 'string' && (answer as string).length > 0)
        : typeof answer === 'string' && answer.trim().length > 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            {agent.emoji} {agent.default_display_name}
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
        <div className="modal-progress">
          <div
            className="modal-progress-fill"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
        <p className="modal-question">{q.question}</p>
        <div className="modal-body">
          {q.type === 'text' && (
            <input
              className="settings-input"
              value={(answer as string) || (q.default || '')}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={q.default || ''}
              autoFocus
            />
          )}
          {q.type === 'number' && (
            <input
              type="number"
              className="settings-input"
              value={(answer as string) || ''}
              onChange={(e) => setAnswer(e.target.value)}
              autoFocus
            />
          )}
          {q.type === 'select' && (
            <div className="settings-domain-row">
              {q.options?.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`settings-chip${answer === opt ? ' is-active' : ''}`}
                  onClick={() => setAnswer(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
          {q.type === 'multi_select' && (
            <div className="settings-domain-row">
              {q.options?.map((opt) => {
                const active = Array.isArray(answer) && answer.includes(opt)
                return (
                  <button
                    key={opt}
                    type="button"
                    className={`settings-chip${active ? ' is-active' : ''}`}
                    onClick={() => toggleMulti(opt)}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>
        )}
        <div className="modal-foot">
          {step > 0 && (
            <button
              type="button"
              className="card-ghost"
              onClick={() => setStep(step - 1)}
              disabled={saving}
            >
              Back
            </button>
          )}
          <button
            type="button"
            className="card-primary"
            onClick={next}
            disabled={saving || !canAdvance}
          >
            {saving
              ? 'Saving…'
              : step === total - 1
                ? 'Finish'
                : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
