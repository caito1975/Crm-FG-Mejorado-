import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import DashboardClient from '@/components/dashboard/DashboardClient'
import type { Contact, Deal, Task, Activity } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId } = await getWorkspaceOwnerId(supabase, user)

  const [
    { data: contacts },
    { data: deals },
    { data: tasks },
    { data: activities },
  ] = await Promise.all([
    supabase.from('contacts').select('*').eq('user_id', workspaceId).order('created_at', { ascending: false }),
    supabase.from('deals').select('*, contact:contacts(id,name,company)').eq('user_id', workspaceId),
    supabase.from('tasks').select('*, contact:contacts(id,name,company)').eq('user_id', workspaceId).order('created_at', { ascending: false }),
    supabase.from('activities').select('*, contact:contacts(id,name,company)').eq('user_id', workspaceId).order('created_at', { ascending: false }).limit(10),
  ])

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'

  return (
    <>
      <Topbar
        crumbs={[{ label: 'Dashboard' }]}
        actions={
          <>
            <button className="btn"><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Última semana</span></button>
            <button className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>+ Nuevo deal</button>
          </>
        }
      />
      <div className="view">
        <DashboardClient
          userId={workspaceId}
          userName={userName}
          initialContacts={(contacts as Contact[]) ?? []}
          initialDeals={(deals as Deal[]) ?? []}
          initialTasks={(tasks as Task[]) ?? []}
          initialActivities={(activities as Activity[]) ?? []}
        />
      </div>
    </>
  )
}
