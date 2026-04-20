'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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

  const color = profile?.user_color || '#C8A96E'
  const assistantName = profile?.assistant_name || 'Nova'
  const domains = (profile?.domains || ['personal']) as Domain[]

  const themeStyle = {
    ['--user-color' as string]: color,
    ['--user-color-dim' as string]: `color-mix(in srgb, ${color} 15%, transparent)`,
    ['--user-color-border' as string]: `color-mix(in srgb, ${color} 25%, transparent)`,
    ['--user-color-glow' as string]: `color-mix(in srgb, ${color} 10%, transparent)`,
  } as React.CSSProperties

  if (loading) {
    return <div className="app-loading">◎</div>
  }

  return (
    <div className="app-shell" style={themeStyle}>
      <aside className="app-sidebar">
        <div className="app-brand">
          <span className="app-brand-mark">◎</span>
          <span className="app-brand-name">{assistantName.toLowerCase()}</span>
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
                  onClick={() => setActiveDomain(d)}
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
