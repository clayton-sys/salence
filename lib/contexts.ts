import { supabase } from './supabase'

export interface UserContext {
  id: string
  user_id: string
  slug: string
  label: string
  color: string | null
  icon: string | null
  is_default: boolean
  created_at: string
}

export function toSlug(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export async function fetchContexts(userId: string): Promise<UserContext[]> {
  const { data, error } = await supabase
    .from('contexts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('fetchContexts:', error.message)
    return []
  }
  return (data || []) as UserContext[]
}

export async function createContext(input: {
  user_id: string
  label: string
  color?: string | null
  icon?: string | null
}): Promise<UserContext | null> {
  const slug = toSlug(input.label)
  if (!slug) return null
  const { data, error } = await supabase
    .from('contexts')
    .insert({
      user_id: input.user_id,
      slug,
      label: input.label.trim(),
      color: input.color || null,
      icon: input.icon || null,
      is_default: false,
    })
    .select('*')
    .single()
  if (error) {
    console.error('createContext:', error.message)
    return null
  }
  return data as UserContext
}

export async function updateContext(
  id: string,
  patch: Partial<Pick<UserContext, 'label' | 'color' | 'icon'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('contexts')
    .update(patch)
    .eq('id', id)
  if (error) {
    console.error('updateContext:', error.message)
    return false
  }
  return true
}

export async function deleteContext(id: string): Promise<boolean> {
  const { error } = await supabase.from('contexts').delete().eq('id', id)
  if (error) {
    console.error('deleteContext:', error.message)
    return false
  }
  return true
}

export async function countRecordsForContext(
  userId: string,
  slug: string
): Promise<number> {
  const { count } = await supabase
    .from('records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('domain', slug)
  return count || 0
}
