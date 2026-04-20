import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

// Browser client with cookie-based session for RLS.
// The auth-helpers shim re-exports @supabase/ssr primitives.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
