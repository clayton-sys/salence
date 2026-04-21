import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase-server'
import { ProfileProvider } from '@/lib/profile-context'
import { ThemeProvider } from '@/lib/theme-provider'
import AppShell from './_shell/AppShell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed_at, assistant_name')
    .eq('id', user.id)
    .maybeSingle()

  // Gate on the authoritative flag. Fall back to assistant_name for users
  // who completed onboarding before the column existed.
  const done =
    !!profile?.onboarding_completed_at || !!profile?.assistant_name
  if (!done) redirect('/onboarding')

  return (
    <ProfileProvider>
      <ThemeProvider>
        <AppShell>{children}</AppShell>
      </ThemeProvider>
    </ProfileProvider>
  )
}
