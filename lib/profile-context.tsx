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
import type { UserProfile, Domain } from './types'

interface ProfileContextValue {
  profile: UserProfile | null
  userId: string | null
  loading: boolean
  refreshProfile: () => Promise<void>
  activeDomain: Domain
  setActiveDomain: (d: Domain) => void
  memoryCount: number
  refreshMemoryCount: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeDomain, setActiveDomain] = useState<Domain>('personal')
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
  }, [refreshMemoryCount, activeDomain])

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      userId,
      loading,
      refreshProfile,
      activeDomain,
      setActiveDomain,
      memoryCount,
      refreshMemoryCount,
    }),
    [
      profile,
      userId,
      loading,
      refreshProfile,
      activeDomain,
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
