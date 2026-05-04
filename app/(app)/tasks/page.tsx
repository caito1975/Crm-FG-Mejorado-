import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import TasksClient from '@/components/tasks/TasksClient'
import type { Task, Contact } from '@/lib/types'

export default async function TasksPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId } = await getWorkspaceOwnerId(supabase, user)

  const [{ data: tasks }, { data: contacts }] = await Promise.all([
    supabase.from('tasks').select('*, contact:contacts(id,name,company)').eq('user_id', workspaceId).order('created_at', { ascending: false }),
    supabase.from('contacts').select('id,name,company').eq('user_id', workspaceId).order('name'),
  ])

  return (
    <>
      <Topbar crumbs={[{ label: 'Tareas' }]} />
      <div className="view">
        <TasksClient
          userId={workspaceId}
          initialTasks={(tasks as Task[]) ?? []}
          contacts={(contacts as Pick<Contact, 'id' | 'name' | 'company'>[]) ?? []}
        />
      </div>
    </>
  )
}
