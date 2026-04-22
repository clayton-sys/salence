import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client — bypasses RLS. Only call this from trusted server
 * code. Kept in its own file (no `next/headers` import) so client bundles
 * pulling in modules that need service-role logging don't fail the build.
 */
export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Service role client unavailable: SUPABASE_SERVICE_ROLE_KEY not set'
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
