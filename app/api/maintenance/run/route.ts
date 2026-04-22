import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-service'
import { runTasksForUser } from '@/lib/maintenance/runner'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  const maintenanceSecret = process.env.MAINTENANCE_SECRET
  const cronSecret = process.env.CRON_SECRET
  if (!maintenanceSecret && !cronSecret) {
    return NextResponse.json(
      { error: 'MAINTENANCE_SECRET or CRON_SECRET must be configured' },
      { status: 500 }
    )
  }
  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  // Manual triggers can send: x-maintenance-secret: <MAINTENANCE_SECRET>
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const manual = req.headers.get('x-maintenance-secret')
  const authorized =
    (cronSecret && bearer === cronSecret) ||
    (maintenanceSecret && manual === maintenanceSecret)
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let supabase
  try {
    supabase = getServiceSupabase()
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }

  // Iterate every user with a profile row. Profiles are auto-created on
  // first sign-in so this equals the active user set.
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const now = new Date()
  const results = []
  for (const p of profiles || []) {
    const summaries = await runTasksForUser(supabase, p.id, now)
    results.push({ user_id: p.id, summaries })
  }

  return NextResponse.json({
    ok: true,
    ran_at: now.toISOString(),
    users: results.length,
    results,
  })
}

export async function GET(req: Request) {
  // Vercel Cron fires GET by default. Accept both.
  return POST(req)
}
