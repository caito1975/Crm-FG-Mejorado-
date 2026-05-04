import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import ContactDetail from '@/components/contacts/ContactDetail'
import type { Contact, Deal, Task, Activity } from '@/lib/types'

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId } = await getWorkspaceOwnerId(supabase, user)

  const [
    { data: contact },
    { data: deals },
    { data: tasks },
    { data: activities },
  ] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', params.id).eq('user_id', workspaceId).single(),
    supabase.from('deals').select('*').eq('contact_id', params.id).order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').eq('contact_id', params.id).order('created_at', { ascending: false }),
    supabase.from('activities').select('*').eq('contact_id', params.id).order('created_at', { ascending: false }),
  ])

  if (!contact) notFound()

  return (
    <>
      <Topbar crumbs={[{ label: 'Contactos', href: '/contacts' }, { label: contact.name }]} />
      <div className="view">
        <ContactDetail
          userId={workspaceId}
          contact={contact as Contact}
          initialDeals={(deals as Deal[]) ?? []}
          initialTasks={(tasks as Task[]) ?? []}
          initialActivities={(activities as Activity[]) ?? []}
        />
      </div>
    </>
  )
}
