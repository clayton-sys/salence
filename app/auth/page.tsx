'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-mark">◎</span>
          <span className="auth-wordmark">salence</span>
        </div>

        {sent ? (
          <div className="auth-sent">
            <h2>Check your email</h2>
            <p>
              We sent a magic link to <strong>{email}</strong>.
            </p>
            <p className="auth-hint">Click the link to finish signing in.</p>
          </div>
        ) : (
          <form onSubmit={sendLink} className="auth-form">
            <label className="auth-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              required
              autoFocus
              className="auth-input"
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="auth-button"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
            {error && <p className="auth-error">{error}</p>}
            <p className="auth-tagline">Your memory. Your model. Your data.</p>
          </form>
        )}
      </div>
    </main>
  )
}
