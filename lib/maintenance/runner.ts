import type { SupabaseClient } from '@supabase/supabase-js'
import { MAINTENANCE_TASKS } from './registry'
import type { MaintenanceTask } from './types'

export interface RunSummary {
  user_id: string
  task_id: string
  ok: boolean
  records_affected: number
  notes: string
  error?: string
}

export async function runTasksForUser(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<RunSummary[]> {
  const summaries: RunSummary[] = []
  for (const task of MAINTENANCE_TASKS) {
    if (!shouldRunNow(task, now)) continue
    summaries.push(await runOne(supabase, userId, task, now))
  }
  return summaries
}

function shouldRunNow(task: MaintenanceTask, now: Date): boolean {
  if (task.schedule === 'daily') return true
  if (task.schedule === 'weekly') return now.getDay() === 0
  if (task.schedule === 'monthly') return now.getDate() === 1
  return false
}

async function runOne(
  supabase: SupabaseClient,
  userId: string,
  task: MaintenanceTask,
  now: Date
): Promise<RunSummary> {
  const { data: runRow } = await supabase
    .from('maintenance_runs')
    .insert({
      user_id: userId,
      task_id: task.id,
      status: 'running',
    })
    .select('id')
    .single()
  const runId = runRow?.id as string | undefined

  try {
    const result = await task.run({ supabase, userId, now })
    if (runId) {
      await supabase
        .from('maintenance_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_affected: result.records_affected,
          cost_usd: result.cost_usd,
          notes: result.notes,
        })
        .eq('id', runId)
    }
    return {
      user_id: userId,
      task_id: task.id,
      ok: true,
      records_affected: result.records_affected,
      notes: result.notes,
    }
  } catch (err) {
    const msg = (err as Error).message
    if (runId) {
      await supabase
        .from('maintenance_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error: msg,
        })
        .eq('id', runId)
    }
    return {
      user_id: userId,
      task_id: task.id,
      ok: false,
      records_affected: 0,
      notes: '',
      error: msg,
    }
  }
}
