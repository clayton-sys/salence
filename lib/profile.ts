import type { CSSProperties } from 'react'
import { supabase } from './supabase'
import type { UserProfile, Domain } from './types'

export async function getProfile(): Promise<UserProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  if (error) {
    console.error('Get profile error:', error)
    return null
  }
  return data as UserProfile | null
}

export async function upsertProfile(
  patch: Partial<UserProfile>
): Promise<UserProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const payload = { id: user.id, ...patch }
  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()
  if (error) {
    console.error('Upsert profile error:', error)
    return null
  }
  return data as UserProfile
}

export function deriveColorVars(hex: string) {
  // returns inline style object for :root overrides
  return {
    '--user-color': hex,
    '--user-color-dim': `color-mix(in srgb, ${hex} 15%, transparent)`,
    '--user-color-border': `color-mix(in srgb, ${hex} 25%, transparent)`,
    '--user-color-glow': `color-mix(in srgb, ${hex} 10%, transparent)`,
  } as CSSProperties
}

export const PRESET_COLORS = [
  '#C8A96E',
  '#7B9FE0',
  '#7EC8A4',
  '#E643AC',
  '#E8A87C',
  '#9B8EC4',
]

export const DEFAULT_DOMAINS: Domain[] = ['personal']
