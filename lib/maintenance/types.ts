import type { SupabaseClient } from '@supabase/supabase-js'

export type MaintenanceSchedule = 'daily' | 'weekly' | 'monthly'

export interface MaintenanceTask {
  id: string
  name: string
  schedule: MaintenanceSchedule
  run: (ctx: MaintenanceContext) => Promise<MaintenanceResult>
}

export interface MaintenanceContext {
  supabase: SupabaseClient
  userId: string
  now: Date
}

export interface MaintenanceResult {
  records_affected: number
  cost_usd: number
  notes: string
}
