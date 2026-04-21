'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { saveRecord, makeRecord } from '@/lib/memory-kernel'
import { upsertProfile } from '@/lib/profile'
import { THEME_SEEDS } from '@/lib/theme'
import { ALL_DOMAINS, DOMAIN_META, type Domain } from '@/lib/types'

const ASSISTANT_SUGGESTIONS = ['Nova', 'Atlas', 'Sage', 'Echo', 'Iris']
const TOTAL_STEPS = 5

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
  const [color, setColor] = useState(THEME_SEEDS[0].hex)
  // step 4
  const [importText, setImportText] = useState('')

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

  // Clean up any legacy localStorage API keys from the pre-server-key era.
  useEffect(() => {
    try {
      localStorage.removeItem('salence_api_key')
    } catch {
      /* localStorage blocked */
    }
  }, [])

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
        provider: 'claude',
        domains,
        user_color: color,
        assistant_name: assistantName || 'Nova',
        settings: {},
        onboarding_completed_at: new Date().toISOString(),
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

      router.replace('/chat')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const themeStyle = {
    ['--user-color' as string]: color,
    ['--accent' as string]: color,
  } as React.CSSProperties

  return (
    <main className="onboarding-shell" style={themeStyle}>
      <div className="onboarding-progress">
        <span>
          Step {step + 1} of {TOTAL_STEPS}
        </span>
        <div className="onboarding-progress-bar">
          <div
            className="onboarding-progress-fill"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
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
                <span>◈</span>Your memory is exportable and portable. You own it.
              </li>
              <li>
                <span>⟁</span>Row-level security. Only you can read your data.
              </li>
              <li>
                <span>◬</span>Swap in agents: meal planning, email triage,
                coach, signal keeper.
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

            <label className="onboarding-label">Choose an accent color</label>
            <div className="onboarding-color-row">
              {THEME_SEEDS.map((seed) => (
                <button
                  key={seed.hex}
                  type="button"
                  className={`onboarding-swatch${color === seed.hex ? ' is-active' : ''}`}
                  style={{ background: seed.hex }}
                  onClick={() => setColor(seed.hex)}
                  aria-label={seed.name}
                  title={seed.name}
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

            <div className="onboarding-theme-preview">
              <button type="button" className="onboarding-preview-cta">
                Send
              </button>
              <div className="onboarding-preview-card">Muted surface</div>
              <span className="onboarding-preview-link">Accent link</span>
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
            {error && <p className="onboarding-error">{error}</p>}
            <div className="onboarding-actions">
              <button
                className="onboarding-ghost"
                onClick={() => setStep(3)}
              >
                Back
              </button>
              <button
                className="onboarding-primary"
                disabled={saving}
                onClick={finish}
              >
                {saving ? 'Saving…' : 'Start'}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
