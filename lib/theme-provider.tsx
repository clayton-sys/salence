'use client'

import { useEffect } from 'react'
import { useProfile } from './profile-context'
import { deriveTheme, themeStyleVars } from './theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile()
  const seed = profile?.user_color || '#E9C03A'

  useEffect(() => {
    const tokens = deriveTheme(seed)
    const vars = themeStyleVars(tokens)
    const root = document.documentElement
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value)
    }
  }, [seed])

  return <>{children}</>
}
