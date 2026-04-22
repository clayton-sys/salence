'use client'

import { useState } from 'react'
import { useProfile } from '@/lib/profile-context'
import {
  createContext,
  deleteContext,
  updateContext,
  countRecordsForContext,
  toSlug,
  type UserContext,
} from '@/lib/contexts'

const DEFAULT_COLORS = [
  '#E9C03A',
  '#3A6B8A',
  '#AC65C9',
  '#C86F54',
  '#5AA36B',
  '#D8476B',
]

export function ContextsSection() {
  const { userId, contexts, refreshContexts } = useProfile()
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState<string>(DEFAULT_COLORS[0])
  const [newIcon, setNewIcon] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [busy, setBusy] = useState(false)

  async function submitAdd() {
    if (!userId || !newLabel.trim()) return
    setBusy(true)
    await createContext({
      user_id: userId,
      label: newLabel.trim(),
      color: newColor,
      icon: newIcon || null,
    })
    setBusy(false)
    setNewLabel('')
    setNewColor(DEFAULT_COLORS[0])
    setNewIcon('')
    setAdding(false)
    await refreshContexts()
  }

  function beginEdit(c: UserContext) {
    setEditingId(c.id)
    setEditLabel(c.label)
    setEditColor(c.color || DEFAULT_COLORS[0])
    setEditIcon(c.icon || '')
  }

  async function submitEdit() {
    if (!editingId || !editLabel.trim()) return
    setBusy(true)
    await updateContext(editingId, {
      label: editLabel.trim(),
      color: editColor,
      icon: editIcon || null,
    })
    setBusy(false)
    setEditingId(null)
    await refreshContexts()
  }

  async function confirmDelete(c: UserContext) {
    if (!userId) return
    const used = await countRecordsForContext(userId, c.slug)
    const msg =
      used > 0
        ? `${used} records use "${c.label}". They'll remain but become uncategorized. Delete this context?`
        : `Delete context "${c.label}"?`
    if (!window.confirm(msg)) return
    setBusy(true)
    await deleteContext(c.id)
    setBusy(false)
    await refreshContexts()
  }

  return (
    <section className="settings-section">
      <h2>Contexts</h2>
      <p className="settings-muted">
        Contexts are the buckets you work in — personal, work, a specific
        project, a garden bed. Memory tags itself with the active context.
      </p>

      <ul className="settings-context-list">
        {contexts.map((c) =>
          editingId === c.id ? (
            <li key={c.id} className="settings-context-row">
              <input
                className="settings-input"
                value={editIcon}
                onChange={(e) => setEditIcon(e.target.value.slice(0, 4))}
                placeholder="🌱"
                style={{ width: 60 }}
              />
              <input
                className="settings-input"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Label"
              />
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="settings-color-input"
                aria-label="color"
              />
              <button
                type="button"
                className="card-primary"
                disabled={busy}
                onClick={submitEdit}
              >
                Save
              </button>
              <button
                type="button"
                className="card-ghost"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </button>
            </li>
          ) : (
            <li key={c.id} className="settings-context-row">
              <span
                className="settings-context-swatch"
                style={{ background: c.color || '#888' }}
              />
              {c.icon && <span>{c.icon}</span>}
              <span className="settings-context-label">{c.label}</span>
              <span className="settings-muted">/{c.slug}</span>
              <button
                type="button"
                className="card-ghost"
                onClick={() => beginEdit(c)}
              >
                Edit
              </button>
              <button
                type="button"
                className="card-ghost"
                onClick={() => confirmDelete(c)}
                disabled={busy}
              >
                Delete
              </button>
            </li>
          )
        )}
      </ul>

      {adding ? (
        <div className="settings-context-row">
          <input
            className="settings-input"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value.slice(0, 4))}
            placeholder="🌱"
            style={{ width: 60 }}
          />
          <input
            className="settings-input"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Salence"
            autoFocus
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="settings-color-input"
            aria-label="color"
          />
          <span className="settings-muted">/{toSlug(newLabel) || '…'}</span>
          <button
            type="button"
            className="card-primary"
            disabled={busy || !newLabel.trim()}
            onClick={submitAdd}
          >
            Add
          </button>
          <button
            type="button"
            className="card-ghost"
            onClick={() => {
              setAdding(false)
              setNewLabel('')
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="settings-primary"
          onClick={() => setAdding(true)}
        >
          + Add context
        </button>
      )}
    </section>
  )
}
