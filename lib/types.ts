export type ContentType =
  | 'conversation'
  | 'fact'
  | 'decision'
  | 'health'
  | 'family'
  | 'work'
  | 'question'

export type Domain =
  | 'personal'
  | 'work'
  | 'health'
  | 'family'
  | 'garden'
  | 'finance'
  | 'hobby'

export type RecordStatus = 'active' | 'archived' | 'compressed' | 'expired'

export interface MemoryRecord {
  id: string
  user_id: string
  content: string
  content_type: ContentType
  domain: Domain
  tags: string[]
  source: string
  vector: number[]
  weight: number
  status: RecordStatus
  contradicts: string[]
  created_at: string
  last_accessed: string
  expires_hint: string | null
  life_stage: string | null
  structured_data: Record<string, unknown>
}

export interface UserProfile {
  id: string
  name: string
  provider: string
  domains: Domain[]
  user_color: string
  assistant_name: string
  created_at: string
  settings: Record<string, unknown>
  onboarding_completed_at: string | null
  kitchen_onboarded_at: string | null
  inbox_onboarded_at: string | null
  coach_onboarded_at: string | null
  signal_onboarded_at: string | null
}

export interface AssistantContentBlock {
  type: 'text' | 'tool_use' | 'tool_status'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  label?: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string | AssistantContentBlock[]
  ts: number
  err?: boolean
}

export interface AgentConfig {
  id: string
  label: string
  emoji: string
  description: string
  active: boolean
}

export interface AgentRun {
  id: string
  user_id: string
  agent_id: string
  ran_at: string
  result: Record<string, unknown>
}

export const DOMAIN_META: Record<Domain, { label: string; emoji: string }> = {
  personal: { label: 'Personal', emoji: '✨' },
  work: { label: 'Work', emoji: '💼' },
  health: { label: 'Health', emoji: '🌿' },
  family: { label: 'Family', emoji: '🏡' },
  garden: { label: 'Garden', emoji: '🌱' },
  finance: { label: 'Finance', emoji: '📊' },
  hobby: { label: 'Hobbies', emoji: '🎨' },
}

export const ALL_DOMAINS: Domain[] = [
  'personal',
  'work',
  'health',
  'family',
  'garden',
  'finance',
  'hobby',
]
