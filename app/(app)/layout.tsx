import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase-server'
import { ProfileProvider } from '@/lib/profile-context'
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
    .select('assistant_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.assistant_name) redirect('/onboarding')

  return (
    <ProfileProvider>
      <AppShell>{children}</AppShell>
    </ProfileProvider>
  )
}
