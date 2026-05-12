import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import InboxClient from '@/components/inbox/InboxClient'
import type { InboxMessage } from '@/lib/types'

export default async function InboxPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId, isOwner } = await getWorkspaceOwnerId(supabase, user)

  let messages: InboxMessage[] = []

  if (isOwner) {
    // Owner ve todos los mensajes del workspace
    const { data } = await supabase
      .from('inbox_messages')
      .select('*')
      .eq('user_id', workspaceId)
      .order('created_at', { ascending: false })
    messages = (data as InboxMessage[]) ?? []
  } else {
    // Vendor: obtener los nombres de sus contactos asignados
    const { data: assignedContacts } = await supabase
      .from('contacts')
      .select('name')
      .eq('user_id', workspaceId)
      .eq('assigned_to', user.id)

    const assignedNames = (assignedContacts ?? []).map(c => c.name)

    if (assignedNames.length > 0) {
      const { data } = await supabase
        .from('inbox_messages')
        .select('*')
        .eq('user_id', workspaceId)
        .in('from_name', assignedNames)
        .order('created_at', { ascending: false })
      messages = (data as InboxMessage[]) ?? []
    }
  }

  return (
    <>
      <Topbar crumbs={[{ label: 'Inbox' }]} />
      <div className="view flush" style={{ height: 'calc(100vh - var(--topbar-h))' }}>
        <InboxClient userId={workspaceId} initialMessages={messages} />
      </div>
    </>
  )
}
