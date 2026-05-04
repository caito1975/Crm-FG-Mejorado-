import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import ContactsTable from '@/components/contacts/ContactsTable'
import type { Contact } from '@/lib/types'

export default async function ContactsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId } = await getWorkspaceOwnerId(supabase, user)

  const { data: contacts } = await supabase
    .from('contacts').select('*').eq('user_id', workspaceId).order('name')

  return (
    <>
      <Topbar
        crumbs={[{ label: 'Contactos' }]}
        actions={<button className="btn primary" id="new-contact-btn">+ Nuevo contacto</button>}
      />
      <div className="view">
        <ContactsTable userId={workspaceId} initialContacts={(contacts as Contact[]) ?? []} />
      </div>
    </>
  )
}
