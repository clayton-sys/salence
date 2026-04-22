'use client'

import { useState } from 'react'
import { AGENTS } from '@/lib/agents/registry'
import type { AgentDefinition } from '@/lib/agents/types'

interface Props {
  agentId: string
  onClose: () => void
  onDone: () => void
}

type AnswerMap = Record<string, string | string[] | number>

// Seed the answers map with defaults for every text/number question up
// front. This keeps every input fully controlled from render #1, which
// prevents the controlled → uncontrolled transition crash when the user
// highlights the prefilled default and types a replacement.
function initialAnswers(agent: AgentDefinition | undefined): AnswerMap {
  if (!agent) return {}
  const seed: AnswerMap = {}
  for (const qn of agent.first_run_questions) {
    if (qn.default !== undefined && (qn.type === 'text' || qn.type === 'number')) {
      seed[qn.id] = qn.default
    }
  }
  return seed
}

export function AgentOnboardModal({ agentId, onClose, onDone }: Props) {
  const agent = AGENTS[agentId]
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<AnswerMap>(() => initialAnswers(agent))
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const q = agent?.first_run_questions[step]

  if (!agent || !q) return null
  const total = agent.first_run_questions.length
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
      setSuccess(true)
      setTimeout(() => onDone(), 1500)
    } catch (err) {
      setError((err as Error).message)
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

  const finalName =
    (answers.display_name as string) || agent.default_display_name

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !success) onClose()
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            {agent.emoji} {agent.default_display_name}
          </h3>
          {!success && (
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
        {success ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <p style={{ fontSize: 16, margin: 0 }}>
              You&rsquo;re all set with {finalName}. Tap &ldquo;Run now&rdquo; to start.
            </p>
          </div>
        ) : (
          <>
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
                  value={(answer as string) ?? ''}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={q.default || ''}
                  autoFocus
                />
              )}
              {q.type === 'number' && (
                <input
                  type="number"
                  className="settings-input"
                  value={
                    typeof answer === 'number'
                      ? answer
                      : ((answer as string) ?? '')
                  }
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
          </>
        )}
      </div>
    </div>
  )
}
