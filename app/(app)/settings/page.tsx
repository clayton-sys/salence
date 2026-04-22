'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/lib/profile-context'
import { upsertProfile } from '@/lib/profile'
import { THEME_SEEDS } from '@/lib/theme'
import { MODEL_CONFIG } from '@/lib/model-router'
import { ALL_DOMAINS, DOMAIN_META, type Domain } from '@/lib/types'
import { ContextsSection } from '@/components/settings/ContextsSection'

export default function SettingsPage() {
  const { profile, userId, refreshProfile } = useProfile()
  const [assistantName, setAssistantName] = useState('')
  const [color, setColor] = useState('#E9C03A')
  const [activeDomains, setActiveDomains] = useState<Domain[]>([])
  const [savedSection, setSavedSection] = useState<'assistant' | null>(null)

  useEffect(() => {
    if (!profile) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setAssistantName(profile.assistant_name || '')
    setColor(profile.user_color || '#E9C03A')
    setActiveDomains((profile.domains as Domain[]) || ['personal'])
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [profile])

  async function saveAssistant() {
    await upsertProfile({
      assistant_name: assistantName || 'Nova',
      user_color: color,
      domains: activeDomains,
    })
    await refreshProfile()
    flashSaved()
  }

  function exportAll() {
    ;(async () => {
      if (!userId) return
      const { data } = await supabase
        .from('records')
        .select('*')
        .eq('user_id', userId)
      const blob = new Blob([JSON.stringify(data || [], null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `salence-full-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })()
  }

  async function deleteAll() {
    if (!userId) return
    const sure = window.confirm(
      'Delete ALL of your memory records? This cannot be undone.'
    )
    if (!sure) return
    const really = window.confirm('Really really sure? Last chance.')
    if (!really) return
    await supabase.from('records').delete().eq('user_id', userId)
    window.location.reload()
  }

  function flashSaved() {
    setSavedSection('assistant')
    setTimeout(() => setSavedSection(null), 1600)
  }

  function toggleDomain(d: Domain) {
    setActiveDomains((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    )
  }

  return (
    <section className="settings-view">
      <header className="settings-header">
        <h1>Settings</h1>
      </header>

      <section className="settings-section">
        <h2>Your assistant</h2>
        <label className="settings-label">Name</label>
        <input
          className="settings-input"
          value={assistantName}
          onChange={(e) => setAssistantName(e.target.value)}
        />

        <label className="settings-label">Accent color</label>
        <div className="settings-color-row">
          {THEME_SEEDS.map((seed) => (
            <button
              key={seed.hex}
              type="button"
              className={`settings-swatch${color === seed.hex ? ' is-active' : ''}`}
              style={{ background: seed.hex }}
              onClick={() => setColor(seed.hex)}
              aria-label={seed.name}
              title={seed.name}
            />
          ))}
          <label className="settings-swatch-custom" title="Custom color">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <span>+</span>
          </label>
        </div>

        <label className="settings-label">Active contexts</label>
        <div className="settings-domain-row">
          {ALL_DOMAINS.map((d) => {
            const meta = DOMAIN_META[d]
            const active = activeDomains.includes(d)
            return (
              <button
                key={d}
                type="button"
                className={`settings-chip${active ? ' is-active' : ''}`}
                onClick={() => toggleDomain(d)}
              >
                {meta.emoji} {meta.label}
              </button>
            )
          })}
        </div>

        <div className="settings-theme-preview">
          <button type="button" className="settings-preview-cta">
            Send button
          </button>
          <div className="settings-preview-card">Muted surface</div>
          <span className="settings-preview-link">Accent link</span>
        </div>

        <button className="settings-primary" onClick={saveAssistant}>
          Save assistant
        </button>
        {savedSection === 'assistant' && (
          <p className="settings-flash-inline">✓ Saved</p>
        )}
      </section>

      <ContextsSection />

      <section className="settings-section">
        <h2>Model routing</h2>
        <p className="settings-muted">
          Your API key lives on the server now — you never have to think about
          it. Model routing is managed by the platform.
        </p>
        <div className="settings-tier">
          <h3>Haiku tier</h3>
          <p>
            <code>{MODEL_CONFIG.haiku.provider}</code> ·{' '}
            <code>{MODEL_CONFIG.haiku.model}</code>
          </p>
          <p className="settings-muted">
            Fast, cheap calls: extraction, categorization, tagging, patches,
            short summaries, quick replies.
          </p>
        </div>
        <div className="settings-tier">
          <h3>Sonnet tier</h3>
          <p>
            <code>{MODEL_CONFIG.sonnet.provider}</code> ·{' '}
            <code>{MODEL_CONFIG.sonnet.model}</code>
          </p>
          <p className="settings-muted">
            Conversation, planning, artifact generation, nuanced composition,
            agent runs.
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h2>Sovereignty</h2>
        <ul className="settings-check-list">
          <li>◉ Your memory is yours. Export anytime.</li>
          <li>◉ Row-level security on every read.</li>
          <li>◉ Open JSON export. No lock-in.</li>
        </ul>
        <div className="settings-actions">
          <button className="settings-ghost" onClick={exportAll}>
            Export all memory
          </button>
          <button className="settings-danger" onClick={deleteAll}>
            Delete all memory
          </button>
        </div>
      </section>
    </section>
  )
}
