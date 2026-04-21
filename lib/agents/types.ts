import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserProfile, MemoryRecord } from '@/lib/types'
import type { TaskType } from '@/lib/model-router'

export interface AgentProfile {
  id: string
  user_id: string
  agent_id: string
  display_name: string | null
  voice: string
  enabled: boolean
  last_run_at: string | null
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type Voice =
  | 'assistant'
  | 'coach'
  | 'concierge'
  | 'analyst'
  | 'curator'

export interface AgentContext {
  userId: string
  supabase: SupabaseClient
  profile: UserProfile | null
  agentProfile: AgentProfile | null
  recentRecords: MemoryRecord[]
  now: Date
}

export interface FirstRunQuestion {
  id: string
  question: string
  type: 'text' | 'select' | 'multi_select' | 'number'
  options?: string[]
  default?: string
}

export interface AgentDefinition {
  id: string
  default_display_name: string
  description: string
  emoji: string
  task_type: TaskType
  voices: Voice[]
  first_run_questions: FirstRunQuestion[]
  tools: string[]
  card_tools: string[]
  cadence_hint: string
  buildSystemPrompt: (ctx: AgentContext) => string
  /**
   * Optional initial user message used when the agent runs without
   * an explicit user prompt (i.e. "Run now" from Cortex).
   */
  buildKickoffMessage?: (ctx: AgentContext) => string
}
