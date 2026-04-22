'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/lib/profile-context'
import type { MemoryRecord } from '@/lib/types'

type ExportFormat = 'markdown' | 'obsidian' | 'notion'

export default function NotesPage() {
  const { userId, contexts } = useProfile()
  const [notes, setNotes] = useState<MemoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSlug, setFilterSlug] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .eq('content_type', 'note')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    setNotes((data || []) as MemoryRecord[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (filterSlug && n.domain !== filterSlug) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!n.content.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [notes, filterSlug, search])

  function beginEdit(n: MemoryRecord) {
    setEditingId(n.id)
    setEditText(n.content)
  }

  async function saveEdit() {
    if (!editingId) return
    await supabase
      .from('records')
      .update({ content: editText })
      .eq('id', editingId)
    setEditingId(null)
    await load()
    flashOk('Saved')
  }

  async function deleteNote(id: string) {
    if (!window.confirm('Delete this note?')) return
    await supabase.from('records').delete().eq('id', id)
    await load()
  }

  async function copyNote(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      flashOk('Copied')
    } catch {
      /* ignore */
    }
  }

  function flashOk(msg: string) {
    setFlash(msg)
    setTimeout(() => setFlash(null), 1600)
  }

  function contextLabel(slug: string): string {
    return contexts.find((c) => c.slug === slug)?.label || slug
  }

  function exportNotes(format: ExportFormat) {
    const stamp = new Date().toISOString().slice(0, 10)
    const scope = filterSlug ? filterSlug : 'all'
    const file = buildExport(filtered, format, contextLabel)
    const blob = new Blob([file.content], { type: file.mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `salence-notes-${scope}-${stamp}.${file.ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  function exportNotionStub() {
    window.alert(
      'Notion export is one-way (snapshot) and requires the Notion MCP connector to be authenticated. Coming soon — for now use Markdown.'
    )
    setExportOpen(false)
  }

  return (
    <section className="memory-view">
      <header className="memory-header">
        <div>
          <h1>Notes</h1>
          <p className="memory-sub">
            {filtered.length} {filtered.length === 1 ? 'note' : 'notes'}
            {filterSlug ? ` in ${contextLabel(filterSlug)}` : ''}
          </p>
        </div>
        <div className="notes-export-wrap">
          <button
            className="memory-export"
            onClick={() => setExportOpen((v) => !v)}
          >
            Export ▾
          </button>
          {exportOpen && (
            <div className="notes-export-menu">
              <button onClick={() => exportNotes('markdown')}>Markdown (.md)</button>
              <button onClick={() => exportNotes('obsidian')}>
                Obsidian (.md + frontmatter)
              </button>
              <button onClick={exportNotionStub}>Notion (snapshot)</button>
            </div>
          )}
        </div>
      </header>

      <div className="memory-filter-row">
        <button
          className={`memory-filter${filterSlug === null ? ' is-active' : ''}`}
          onClick={() => setFilterSlug(null)}
        >
          All
        </button>
        {contexts.map((c) => (
          <button
            key={c.id}
            className={`memory-filter${filterSlug === c.slug ? ' is-active' : ''}`}
            onClick={() =>
              setFilterSlug(filterSlug === c.slug ? null : c.slug)
            }
          >
            {c.icon && <span>{c.icon}</span>}
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      <div className="notes-search-row">
        <input
          className="settings-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
        />
        {flash && <span className="settings-flash-inline">✓ {flash}</span>}
      </div>

      {loading && <p className="memory-empty">Loading…</p>}
      {!loading && filtered.length === 0 && (
        <div className="memory-empty">
          <p>No notes yet.</p>
          <p className="memory-muted">
            Try saying &ldquo;save note: broccoli raab is bolting in the north bed&rdquo;
            in chat.
          </p>
        </div>
      )}

      <div className="memory-grid">
        {filtered.map((n) => (
          <article key={n.id} className="memory-card status-active">
            <div className="memory-card-top">
              <span className="memory-domain-badge">
                {contextLabel(n.domain) || 'uncategorized'}
              </span>
              <span className="memory-type-badge">note</span>
            </div>
            {editingId === n.id ? (
              <textarea
                className="settings-input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={4}
              />
            ) : (
              <p className="memory-card-content">{n.content}</p>
            )}
            <div className="memory-card-meta">
              <span>{new Date(n.created_at).toLocaleString()}</span>
            </div>
            <div className="notes-card-actions">
              {editingId === n.id ? (
                <>
                  <button className="card-primary" onClick={saveEdit}>
                    Save
                  </button>
                  <button
                    className="card-ghost"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button className="card-ghost" onClick={() => beginEdit(n)}>
                    Edit
                  </button>
                  <button
                    className="card-ghost"
                    onClick={() => copyNote(n.content)}
                  >
                    Copy
                  </button>
                  <button
                    className="card-ghost"
                    onClick={() => deleteNote(n.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function buildExport(
  notes: MemoryRecord[],
  format: ExportFormat,
  labelFor: (slug: string) => string
): { content: string; mime: string; ext: string } {
  const stamp = new Date().toISOString().slice(0, 10)

  if (format === 'obsidian') {
    const lines: string[] = []
    lines.push('---')
    lines.push('source: salence')
    lines.push(`exported: ${stamp}`)
    lines.push(`count: ${notes.length}`)
    lines.push('---\n')
    for (const n of notes) {
      const date = new Date(n.created_at).toISOString().slice(0, 10)
      lines.push(`## ${date} — ${labelFor(n.domain)}`)
      lines.push('')
      lines.push(`> tags: ${(n.tags || []).join(', ') || '—'}`)
      lines.push('')
      lines.push(n.content)
      lines.push('')
    }
    return { content: lines.join('\n'), mime: 'text/markdown', ext: 'md' }
  }

  // markdown and notion-snapshot share the same structure; notion exporter
  // isn't implemented yet (see exportNotionStub).
  const byContext = new Map<string, MemoryRecord[]>()
  for (const n of notes) {
    const k = n.domain || 'uncategorized'
    const bucket = byContext.get(k) || []
    bucket.push(n)
    byContext.set(k, bucket)
  }
  const lines: string[] = []
  lines.push(`# Salence notes — ${stamp}`)
  lines.push('')
  for (const [slug, bucket] of byContext) {
    lines.push(`## ${labelFor(slug)}`)
    lines.push('')
    for (const n of bucket) {
      const date = new Date(n.created_at).toISOString().slice(0, 10)
      lines.push(`- **${date}** — ${n.content.replace(/\n/g, ' ')}`)
    }
    lines.push('')
  }
  return { content: lines.join('\n'), mime: 'text/markdown', ext: 'md' }
}
