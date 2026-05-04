import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [
    { count: contactCount },
    { count: dealCount },
    { count: taskCount },
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('done', false),
  ])

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'

  return (
    <AppShell
      userName={userName}
      userRole="Owner"
      contactCount={contactCount ?? 0}
      dealCount={dealCount ?? 0}
      taskCount={taskCount ?? 0}
      teamCount={0}
      inboxCount={0}
    >
      {children}
    </AppShell>
  )
}
