'use client'

import { useState } from 'react'

type Bucket = 'act_today' | 'reply_this_week' | 'fyi' | 'noise'

interface Email {
  thread_id: string
  from: string
  subject: string
  summary: string
  drafted_reply?: string
}
interface Category {
  category: Bucket
  emails: Email[]
}

interface Props {
  title: string
  generated_at: string
  categories: Category[]
  noise_summary?: string
}

const LABELS: Record<Bucket, string> = {
  act_today: 'Act today',
  reply_this_week: 'Reply this week',
  fyi: 'FYI',
  noise: 'Noise',
}

export function EmailDigestCard({
  title,
  generated_at,
  categories,
  noise_summary,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const c of categories) {
      for (const e of c.emails) {
        if (e.drafted_reply) out[e.thread_id] = e.drafted_reply
      }
    }
    return out
  })
  const [status, setStatus] = useState<Record<string, 'pending' | 'queued' | 'discarded'>>({})

  function setStatusFor(id: string, s: 'pending' | 'queued' | 'discarded') {
    setStatus((prev) => ({ ...prev, [id]: s }))
  }

  async function queueSend(threadId: string, from: string, subject: string) {
    setStatusFor(threadId, 'queued')
    await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draft_type: 'email',
        agent_id: 'inbox-triage',
        content: {
          thread_id: threadId,
          to: from,
          subject,
          body: drafts[threadId] || '',
        },
      }),
    })
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">{title}</h3>
        <span className="card-subtitle">{generated_at}</span>
      </div>

      {categories.map((cat) => (
        <div key={cat.category} className="card-section">
          <p className="card-section-label">
            {LABELS[cat.category] || cat.category}{' '}
            <span style={{ color: 'var(--text-muted)' }}>
              · {cat.emails.length}
            </span>
          </p>
          {cat.category === 'noise' && noise_summary ? (
            <p className="card-row-sub">{noise_summary}</p>
          ) : (
            cat.emails.map((e) => {
              const s = status[e.thread_id] || 'pending'
              const draft = drafts[e.thread_id]
              return (
                <div key={e.thread_id} className="card-row">
                  <div className="card-row-main">
                    <div className="card-row-title">{e.subject}</div>
                    <div className="card-row-sub">{e.from}</div>
                    <div className="card-row-sub" style={{ marginTop: 4 }}>
                      {e.summary}
                    </div>
                    {draft && (
                      <textarea
                        className="card-notes"
                        style={{ marginTop: 8, minHeight: 80 }}
                        value={draft}
                        onChange={(ev) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [e.thread_id]: ev.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                  {draft && s === 'pending' && (
                    <div className="card-row-actions">
                      <button
                        type="button"
                        className="card-primary"
                        onClick={() => queueSend(e.thread_id, e.from, e.subject)}
                      >
                        Queue send
                      </button>
                      <button
                        type="button"
                        className="card-ghost"
                        onClick={() => setStatusFor(e.thread_id, 'discarded')}
                      >
                        Discard
                      </button>
                    </div>
                  )}
                  {s === 'queued' && (
                    <div className="card-row-actions">
                      <span className="card-pill is-accent">Queued</span>
                    </div>
                  )}
                  {s === 'discarded' && (
                    <div className="card-row-actions">
                      <span className="card-pill">Discarded</span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      ))}
    </div>
  )
}
