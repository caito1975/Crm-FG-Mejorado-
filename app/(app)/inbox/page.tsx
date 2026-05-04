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

  const { workspaceId } = await getWorkspaceOwnerId(supabase, user)

  const { data: messages } = await supabase
    .from('inbox_messages').select('*').eq('user_id', workspaceId).order('created_at', { ascending: false })

  return (
    <>
      <Topbar crumbs={[{ label: 'Inbox' }]} />
      <div className="view flush" style={{ height: 'calc(100vh - var(--topbar-h))' }}>
        <InboxClient userId={workspaceId} initialMessages={(messages as InboxMessage[]) ?? []} />
      </div>
    </>
  )
}
