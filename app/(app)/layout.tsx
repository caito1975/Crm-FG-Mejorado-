import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import AppShell from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { workspaceId, isOwner } = await getWorkspaceOwnerId(supabase, user)

  // Build count filters depending on role
  const [
    { count: contactCount },
    { count: dealCount },
    { count: taskCount },
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', workspaceId),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('user_id', workspaceId),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', workspaceId).eq('done', false),
  ])

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'
  const themePreference   = (user.user_metadata?.crm_theme    as string) || 'Sistema'
  const densityPreference = (user.user_metadata?.crm_density  as string) || 'Normal'
  const currencyPreference = (user.user_metadata?.crm_currency as string) || 'ARS'

  // Resolve role label
  let userRole = 'Owner'
  if (!isOwner) {
    const { data: member } = await supabase
      .from('team_members')
      .select('role')
      .eq('member_user_id', user.id)
      .maybeSingle()
    userRole = member?.role || 'Vendedor'
  }

  return (
    <AppShell
      userName={userName}
      userRole={userRole}
      isOwner={isOwner}
      contactCount={contactCount ?? 0}
      dealCount={dealCount ?? 0}
      taskCount={taskCount ?? 0}
      teamCount={0}
      inboxCount={0}
      themePreference={themePreference}
      densityPreference={densityPreference}
      currencyPreference={currencyPreference}
    >
      {children}
    </AppShell>
  )
}
