import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Load counts for sidebar badges
  const [
    { count: contactCount },
    { count: dealCount },
    { count: taskCount },
    { count: teamCount },
    { count: inboxCount },
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('done', false),
    supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
    supabase.from('inbox_messages').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('unread', true),
  ])

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'

  return (
    <div className="app">
      <Sidebar
        userName={userName}
        userRole="Owner"
        contactCount={contactCount ?? 0}
        dealCount={dealCount ?? 0}
        taskCount={taskCount ?? 0}
        teamCount={teamCount ?? 0}
        inboxCount={inboxCount ?? 0}
      />
      <main className="main">
        {children}
      </main>
    </div>
  )
}
