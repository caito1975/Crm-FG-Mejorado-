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
  let senderName: string | null = null

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
    const [{ data: assignedContacts }, { data: tm }] = await Promise.all([
      supabase.from('contacts').select('name').eq('user_id', workspaceId).eq('assigned_to', user.id),
      supabase.from('team_members').select('name').eq('owner_id', workspaceId).eq('member_user_id', user.id).single(),
    ])

    senderName = tm?.name ?? null

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
        <InboxClient userId={workspaceId} initialMessages={messages} senderName={senderName} />
      </div>
    </>
  )
}
