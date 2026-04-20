import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await getServerSupabase()
    await supabase.auth.exchangeCodeForSession(code)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('assistant_name')
        .eq('id', user.id)
        .maybeSingle()

      const target = profile?.assistant_name ? '/chat' : '/onboarding'
      return NextResponse.redirect(new URL(target, requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL('/auth', requestUrl.origin))
}
