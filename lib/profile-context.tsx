'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from './supabase'
import { fetchContexts, type UserContext } from './contexts'
import type { UserProfile, Domain } from './types'

interface ProfileContextValue {
  profile: UserProfile | null
  userId: string | null
  loading: boolean
  refreshProfile: () => Promise<void>
  /** Legacy — kept so older pages still compile. Use activeContextSlug. */
  activeDomain: Domain
  setActiveDomain: (d: Domain) => void
  /** null means "all contexts" — no filter. */
  activeContextSlug: string | null
  setActiveContextSlug: (slug: string | null) => void
  contexts: UserContext[]
  refreshContexts: () => Promise<void>
  memoryCount: number
  refreshMemoryCount: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeDomain, setActiveDomain] = useState<Domain>('personal')
  const [activeContextSlug, setActiveContextSlug] = useState<string | null>(null)
  const [contexts, setContexts] = useState<UserContext[]>([])
  const [memoryCount, setMemoryCount] = useState(0)

  const refreshMemoryCount = useCallback(async () => {
    if (!userId) return
    const { count } = await supabase
      .from('records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')
    setMemoryCount(count || 0)
  }, [userId])

  const refreshContexts = useCallback(async () => {
    if (!userId) return
    const rows = await fetchContexts(userId)
    setContexts(rows)
  }, [userId])

  const refreshProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setProfile(null)
      setUserId(null)
      setLoading(false)
      return
    }
    setUserId(user.id)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    if (data) {
      setProfile(data as UserProfile)
      if (data.domains?.length) setActiveDomain(data.domains[0] as Domain)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProfile()
  }, [refreshProfile])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshMemoryCount()
    refreshContexts()
  }, [refreshMemoryCount, refreshContexts, activeDomain])

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      userId,
      loading,
      refreshProfile,
      activeDomain,
      setActiveDomain,
      activeContextSlug,
      setActiveContextSlug,
      contexts,
      refreshContexts,
      memoryCount,
      refreshMemoryCount,
    }),
    [
      profile,
      userId,
      loading,
      refreshProfile,
      activeDomain,
      activeContextSlug,
      contexts,
      refreshContexts,
      memoryCount,
      refreshMemoryCount,
    ]
  )

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
