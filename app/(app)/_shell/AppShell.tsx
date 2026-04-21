'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useProfile } from '@/lib/profile-context'
import { DOMAIN_META, type Domain } from '@/lib/types'

const NAV = [
  { href: '/chat', label: 'Chat', emoji: '💬' },
  { href: '/memory', label: 'Memory', emoji: '🧠' },
  { href: '/cortex', label: 'Cortex', emoji: '⚡' },
  { href: '/settings', label: 'Settings', emoji: '⚙️' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, activeDomain, setActiveDomain, memoryCount, loading } =
    useProfile()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const assistantName = profile?.assistant_name || 'Nova'
  const domains = (profile?.domains || ['personal']) as Domain[]

  // close drawer when the route changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarOpen(false)
  }, [pathname])

  // lock page scroll behind the drawer
  useEffect(() => {
    if (!sidebarOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [sidebarOpen])

  if (loading) {
    return <div className="app-loading">◎</div>
  }

  return (
    <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      <button
        type="button"
        className="app-hamburger"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
        aria-expanded={sidebarOpen}
      >
        ☰
      </button>

      {sidebarOpen && (
        <div
          className="app-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar${sidebarOpen ? ' is-open' : ''}`}
        aria-hidden={!sidebarOpen && undefined}
      >
        <div className="app-sidebar-head">
          <div className="app-brand">
            <span className="app-brand-mark">◎</span>
            <span className="app-brand-name">{assistantName.toLowerCase()}</span>
          </div>
          <button
            type="button"
            className="app-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="app-section">
          <div className="app-section-label">Contexts</div>
          <div className="app-domain-list">
            {domains.map((d) => {
              const meta = DOMAIN_META[d]
              const active = d === activeDomain
              return (
                <button
                  key={d}
                  type="button"
                  className={`app-domain-btn${active ? ' is-active' : ''}`}
                  onClick={() => {
                    setActiveDomain(d)
                    setSidebarOpen(false)
                  }}
                >
                  <span className="app-domain-emoji">{meta.emoji}</span>
                  <span>{meta.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <nav className="app-nav">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`app-nav-item${active ? ' is-active' : ''}`}
              >
                <span className="app-nav-emoji">{item.emoji}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="app-sidebar-foot">
          <div className="app-memory-count">
            <span className="app-memory-dot" />
            {memoryCount} active {memoryCount === 1 ? 'memory' : 'memories'}
          </div>
        </div>
      </aside>

      <main className="app-main">{children}</main>
    </div>
  )
}
