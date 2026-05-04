import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import CalendarClient from '@/components/calendar/CalendarClient'
import type { Task } from '@/lib/types'

export default async function CalendarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId } = await getWorkspaceOwnerId(supabase, user)

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, contact:contacts(id,name,company)')
    .eq('user_id', workspaceId)
    .order('due_date')

  return (
    <>
      <Topbar crumbs={[{ label: 'Calendario' }]} />
      <div className="view">
        <CalendarClient tasks={(tasks as Task[]) ?? []} />
      </div>
    </>
  )
}
