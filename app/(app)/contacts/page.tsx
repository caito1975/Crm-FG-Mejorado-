import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import ContactsTable from '@/components/contacts/ContactsTable'
import type { Contact } from '@/lib/types'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: { activity?: string; status?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId, isOwner } = await getWorkspaceOwnerId(supabase, user)

  let query = supabase.from('contacts').select('*').eq('user_id', workspaceId).order('name')
  // RLS handles vendor filtering automatically — no extra filter needed here

  const { data: contacts } = await query

  return (
    <>
      <Topbar
        crumbs={[{ label: 'Contactos' }]}
        actions={<button className="btn primary" id="new-contact-btn">+ Nuevo contacto</button>}
      />
      <div className="view">
        <ContactsTable
          userId={workspaceId}
          initialContacts={(contacts as Contact[]) ?? []}
          isOwner={isOwner}
          vendorId={isOwner ? undefined : user.id}
          activityFilter={searchParams?.activity === 'stale' ? 'stale' : undefined}
          statusFilter={searchParams?.status as string | undefined}
        />
      </div>
    </>
  )
}
