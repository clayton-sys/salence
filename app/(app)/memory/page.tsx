'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAllRecords } from '@/lib/memory-kernel'
import { useProfile } from '@/lib/profile-context'
import { DOMAIN_META, type Domain, type MemoryRecord } from '@/lib/types'

export default function MemoryPage() {
  const { userId, profile } = useProfile()
  const [records, setRecords] = useState<MemoryRecord[]>([])
  const [filter, setFilter] = useState<Domain | 'all'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    ;(async () => {
      setLoading(true)
      const data = await getAllRecords(userId)
      setRecords(data)
      setLoading(false)
    })()
  }, [userId])

  const filtered = useMemo(() => {
    if (filter === 'all') return records
    return records.filter((r) => r.domain === filter)
  }, [records, filter])

  const activeCount = useMemo(
    () => records.filter((r) => r.status === 'active').length,
    [records]
  )

  function exportJson() {
    const blob = new Blob([JSON.stringify(records, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    a.download = `salence-memory-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const domains = (profile?.domains || []) as Domain[]

  return (
    <section className="memory-view">
      <header className="memory-header">
        <div>
          <h1>Your Memory</h1>
          <p className="memory-sub">
            {activeCount} active {activeCount === 1 ? 'record' : 'records'} ·{' '}
            {records.length} total
          </p>
        </div>
        <button className="memory-export" onClick={exportJson}>
          Export as JSON
        </button>
      </header>

      <div className="memory-filter-row">
        <button
          className={`memory-filter${filter === 'all' ? ' is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {domains.map((d) => {
          const meta = DOMAIN_META[d]
          return (
            <button
              key={d}
              className={`memory-filter${filter === d ? ' is-active' : ''}`}
              onClick={() => setFilter(d)}
            >
              <span>{meta.emoji}</span> {meta.label}
            </button>
          )
        })}
      </div>

      {loading && <p className="memory-empty">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="memory-empty">
          <p>Nothing here yet.</p>
          <p className="memory-muted">
            Start a conversation and your memory will build itself.
          </p>
        </div>
      )}

      <div className="memory-grid">
        {filtered.map((r) => {
          const meta = DOMAIN_META[r.domain]
          return (
            <article key={r.id} className={`memory-card status-${r.status}`}>
              <div className="memory-card-top">
                <span className="memory-domain-badge">
                  {meta?.emoji} {meta?.label || r.domain}
                </span>
                <span className="memory-type-badge">{r.content_type}</span>
                <span className={`memory-status-badge status-${r.status}`}>
                  {r.status}
                </span>
              </div>
              <p className="memory-card-content">{r.content}</p>
              <div className="memory-card-meta">
                <span>{new Date(r.created_at).toLocaleString()}</span>
                <span>· {r.source}</span>
                <span>· w {r.weight.toFixed(2)}</span>
              </div>
              {r.tags?.length ? (
                <div className="memory-tags">
                  {r.tags.map((t) => (
                    <span key={t} className="memory-tag">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
