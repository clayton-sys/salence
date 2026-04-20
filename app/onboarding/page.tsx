'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { saveRecord, makeRecord } from '@/lib/memory-kernel'
import { upsertProfile, PRESET_COLORS } from '@/lib/profile'
import { ALL_DOMAINS, DOMAIN_META, type Domain } from '@/lib/types'

const ASSISTANT_SUGGESTIONS = ['Nova', 'Atlas', 'Sage', 'Echo', 'Iris']
const PROVIDERS = [
  { id: 'claude', label: 'Claude' },
  { id: 'openai', label: 'ChatGPT' },
  { id: 'ollama', label: 'Local (Ollama)' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)

  // step 1
  const [name, setName] = useState('')
  const [intro, setIntro] = useState('')
  // step 2
  const [domains, setDomains] = useState<Domain[]>(['personal'])
  // step 3
  const [assistantName, setAssistantName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  // step 4
  const [importText, setImportText] = useState('')
  // step 5
  const [provider, setProvider] = useState('claude')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth')
        return
      }
      setUserId(user.id)
    })()
  }, [router])

  function toggleDomain(d: Domain) {
    setDomains((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    )
  }

  async function finish() {
    if (!userId) return
    setSaving(true)
    setError(null)
    try {
      await upsertProfile({
        name: name || 'friend',
        provider,
        domains,
        user_color: color,
        assistant_name: assistantName || 'Nova',
        settings: {},
      })

      if (intro.trim().length >= 10) {
        await saveRecord(
          makeRecord({
            content: intro.trim(),
            contentType: 'fact',
            domain: 'personal',
            tags: ['onboarding', 'intro'],
            source: 'onboarding',
            userId,
          })
        )
      }

      if (importText.trim()) {
        const lines = importText
          .split(/\n+/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
        for (const line of lines) {
          await saveRecord(
            makeRecord({
              content: line,
              contentType: 'fact',
              domain: 'personal',
              tags: ['imported'],
              source: 'import',
              userId,
            })
          )
        }
      }

      if (provider !== 'ollama' && apiKey.trim()) {
        localStorage.setItem('salence_api_key', apiKey.trim())
      }

      router.replace('/chat')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const themeStyle = {
    ['--user-color' as string]: color,
  } as React.CSSProperties

  return (
    <main className="onboarding-shell" style={themeStyle}>
      <div className="onboarding-progress">
        <span>Step {step + 1} of 6</span>
        <div className="onboarding-progress-bar">
          <div
            className="onboarding-progress-fill"
            style={{ width: `${((step + 1) / 6) * 100}%` }}
          />
        </div>
      </div>

      <div className="onboarding-card">
        {step === 0 && (
          <section className="onboarding-step">
            <h1 className="onboarding-headline">
              Your memory.
              <br />
              Your model.
              <br />
              Your data.
            </h1>
            <ul className="onboarding-feature-list">
              <li>
                <span>◎</span>Your assistant remembers you across every
                conversation.
              </li>
              <li>
                <span>⟁</span>Your API key stays in your browser. It never
                touches our servers.
              </li>
              <li>
                <span>◈</span>Your memory is exportable and portable. You own it.
              </li>
              <li>
                <span>◬</span>Pick your model. Swap it anytime.
              </li>
            </ul>
            <button className="onboarding-primary" onClick={() => setStep(1)}>
              Get started
            </button>
          </section>
        )}

        {step === 1 && (
          <section className="onboarding-step">
            <h2 className="onboarding-title">Tell me about yourself</h2>
            <label className="onboarding-label">Your name (optional)</label>
            <input
              className="onboarding-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should I call you?"
            />
            <label className="onboarding-label">Tell me about your life</label>
            <textarea
              className="onboarding-textarea"
              rows={6}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="What matters to you right now? What should I know?"
            />
            <div className="onboarding-actions">
              <button
                className="onboarding-ghost"
                onClick={() => setStep(0)}
              >
                Back
              </button>
              <button
                className="onboarding-primary"
                disabled={intro.trim().length < 10}
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="onboarding-step">
            <h2 className="onboarding-title">
              What parts of your life should I help with?
            </h2>
            <p className="onboarding-subtitle">Pick as many as feel right.</p>
            <div className="onboarding-domain-grid">
              {ALL_DOMAINS.map((d) => {
                const meta = DOMAIN_META[d]
                const active = domains.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    className={`onboarding-domain-card${active ? ' is-active' : ''}`}
                    onClick={() => toggleDomain(d)}
                  >
                    <span className="onboarding-domain-emoji">{meta.emoji}</span>
                    <span className="onboarding-domain-label">{meta.label}</span>
                  </button>
                )
              })}
            </div>
            <div className="onboarding-actions">
              <button
                className="onboarding-ghost"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                className="onboarding-primary"
                disabled={domains.length === 0}
                onClick={() => setStep(3)}
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="onboarding-step">
            <h2 className="onboarding-title">Name your assistant</h2>
            <div className="onboarding-name-wrap">
              <input
                className="onboarding-name-input"
                value={assistantName}
                onChange={(e) => setAssistantName(e.target.value)}
                placeholder="What will you call your assistant?"
                autoFocus
              />
              <div className="onboarding-suggestions">
                {ASSISTANT_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="onboarding-chip"
                    onClick={() => setAssistantName(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="onboarding-muted">
                This is yours. Make it feel like it.
              </p>
            </div>

            <label className="onboarding-label">Choose a color</label>
            <div className="onboarding-color-row">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`onboarding-swatch${color === c ? ' is-active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
              <label className="onboarding-swatch-custom" aria-label="Custom color">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
                <span>+</span>
              </label>
            </div>

            <div className="onboarding-actions">
              <button
                className="onboarding-ghost"
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <button
                className="onboarding-primary"
                disabled={!assistantName.trim()}
                onClick={() => setStep(4)}
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="onboarding-step">
            <h2 className="onboarding-title">Import existing memory</h2>
            <p className="onboarding-subtitle">
              Paste notes, journal lines, or an exported ChatGPT summary. One
              fact per line works best.
            </p>
            <details className="onboarding-details">
              <summary>How to export from ChatGPT</summary>
              <p>
                In ChatGPT: Settings → Data Controls → Export Data. Open the
                zip, then paste the parts that describe you here.
              </p>
            </details>
            <textarea
              className="onboarding-textarea"
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="One fact per line…"
            />
            <div className="onboarding-actions">
              <button
                className="onboarding-ghost"
                onClick={() => setStep(5)}
              >
                Skip for now
              </button>
              <button
                className="onboarding-primary"
                onClick={() => setStep(5)}
              >
                {importText.trim() ? 'Import & continue' : 'Continue'}
              </button>
            </div>
          </section>
        )}

        {step === 5 && (
          <section className="onboarding-step">
            <h2 className="onboarding-title">Connect your AI</h2>

            <label className="onboarding-label">Provider</label>
            <div className="onboarding-provider-row">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`onboarding-provider${provider === p.id ? ' is-active' : ''}`}
                  onClick={() => setProvider(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {provider !== 'ollama' && (
              <>
                <label className="onboarding-label">API key</label>
                <input
                  type="password"
                  className="onboarding-input"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    provider === 'claude' ? 'sk-ant-…' : 'sk-…'
                  }
                />
                <p className="onboarding-sovereign">
                  🔒 Stored on your device only.
                </p>
              </>
            )}

            {provider === 'ollama' && (
              <p className="onboarding-muted">
                Make sure Ollama is running locally on port 11434.
              </p>
            )}

            {error && <p className="onboarding-error">{error}</p>}

            <div className="onboarding-actions">
              <button
                className="onboarding-ghost"
                onClick={() => setStep(4)}
              >
                Back
              </button>
              <button
                className="onboarding-primary"
                disabled={
                  saving ||
                  (provider !== 'ollama' && apiKey.trim().length < 4)
                }
                onClick={finish}
              >
                {saving ? 'Saving…' : 'Start remembering'}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
