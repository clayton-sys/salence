'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/lib/profile-context'
import { upsertProfile, PRESET_COLORS } from '@/lib/profile'
import { MODEL_CONFIG } from '@/lib/model-router'
import { ALL_DOMAINS, DOMAIN_META, type Domain } from '@/lib/types'

const PROVIDERS = [
  { id: 'claude', label: 'Claude (Anthropic)' },
  { id: 'openai', label: 'ChatGPT (OpenAI)' },
  { id: 'ollama', label: 'Local (Ollama)' },
]

export default function SettingsPage() {
  const { profile, userId, refreshProfile } = useProfile()
  const [assistantName, setAssistantName] = useState('')
  const [color, setColor] = useState('#C8A96E')
  const [provider, setProvider] = useState('claude')
  const [apiKey, setApiKey] = useState('')
  const [activeDomains, setActiveDomains] = useState<Domain[]>([])
  const [savedSection, setSavedSection] = useState<'assistant' | 'provider' | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setAssistantName(profile.assistant_name || '')
    setColor(profile.user_color || '#C8A96E')
    setProvider(profile.provider || 'claude')
    setActiveDomains((profile.domains as Domain[]) || ['personal'])
    if (typeof window !== 'undefined') {
      setApiKey(localStorage.getItem('salence_api_key') || '')
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [profile])

  async function saveAssistant() {
    await upsertProfile({
      assistant_name: assistantName || 'Nova',
      user_color: color,
      domains: activeDomains,
    })
    await refreshProfile()
    flashSaved('assistant')
  }

  async function saveProvider() {
    await upsertProfile({ provider })
    if (provider !== 'ollama') {
      // Strip whitespace AND any wrapping quotes — mobile keyboards and
      // password managers often inject these when pasting.
      const cleaned = apiKey.trim().replace(/^["']|["']$/g, '')
      localStorage.setItem('salence_api_key', cleaned)
      setApiKey(cleaned)
    }
    await refreshProfile()
    flashSaved('provider')
  }

  async function testConnection() {
    setTestResult('Testing…')
    try {
      if (provider === 'claude') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey.trim(),
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: MODEL_CONFIG.grunt.model,
            max_tokens: 16,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error.message)
        setTestResult('✓ Connected')
      } else if (provider === 'ollama') {
        const res = await fetch('http://localhost:11434/api/tags')
        if (!res.ok) throw new Error('Ollama not reachable')
        setTestResult('✓ Ollama reachable')
      } else {
        setTestResult('Test not implemented for this provider yet.')
      }
    } catch (err) {
      setTestResult(`✗ ${(err as Error).message}`)
    }
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

  function flashSaved(section: 'assistant' | 'provider') {
    setSavedSection(section)
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

        <label className="settings-label">Color</label>
        <div className="settings-color-row">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`settings-swatch${color === c ? ' is-active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={c}
            />
          ))}
          <label className="settings-swatch-custom">
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

        <div className="settings-preview" style={{ background: color }}>
          Theme preview
        </div>

        <button className="settings-primary" onClick={saveAssistant}>
          Save assistant
        </button>
        {savedSection === 'assistant' && (
          <p className="settings-flash-inline">✓ Saved</p>
        )}
      </section>

      <section className="settings-section">
        <h2>Your AI</h2>
        <label className="settings-label">Provider</label>
        <select
          className="settings-input"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        {provider !== 'ollama' && (
          <>
            <label className="settings-label">API key</label>
            <input
              type="password"
              className="settings-input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'claude' ? 'sk-ant-…' : 'sk-…'}
            />
            <p className="settings-muted">
              🔒 Stored on your device only — never sent to Salence servers.
            </p>
          </>
        )}

        <div className="settings-actions">
          <button className="settings-primary" onClick={saveProvider}>
            Save provider
          </button>
          <button className="settings-ghost" onClick={testConnection}>
            Test connection
          </button>
        </div>
        {savedSection === 'provider' && (
          <p className="settings-flash-inline">✓ Saved — API key stored locally</p>
        )}
        {testResult && <p className="settings-test">{testResult}</p>}
      </section>

      <section className="settings-section">
        <h2>Model routing</h2>
        <p className="settings-muted">
          Which models run which tasks. You can swap providers in{' '}
          <code>lib/model-router.ts</code>.
        </p>
        <div className="settings-tier">
          <h3>Grunt tier</h3>
          <p>
            <code>{MODEL_CONFIG.grunt.provider}</code> ·{' '}
            <code>{MODEL_CONFIG.grunt.model}</code>
          </p>
          <p className="settings-muted">
            Fast, cheap calls: classification, compression, fact extraction,
            decay checks.
          </p>
        </div>
        <div className="settings-tier">
          <h3>Reason tier</h3>
          <p>
            <code>{MODEL_CONFIG.reason.provider}</code> ·{' '}
            <code>{MODEL_CONFIG.reason.model}</code>
          </p>
          <p className="settings-muted">
            Conversation, synthesis, weekly digests.
          </p>
        </div>
        <p className="settings-muted">
          Prefer running locally? Point router at an Ollama model. Your data
          never leaves your machine.
        </p>
      </section>

      <section className="settings-section">
        <h2>Sovereignty</h2>
        <ul className="settings-check-list">
          <li>◉ Your API key lives in your browser only.</li>
          <li>◉ Your memory is yours. Export anytime.</li>
          <li>◉ Row-level security on every read.</li>
          <li>◉ Open formats. No lock-in.</li>
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
