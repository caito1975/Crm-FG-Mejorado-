import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import GestionClient from '@/components/gestion/GestionClient'
import type { TeamMember, HistorialLead, Contact, Deal, SalesTarget } from '@/lib/types'

export default async function GestionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId, isOwner } = await getWorkspaceOwnerId(supabase, user)

  // Load last 400 days — covers hoy/semana/mes/trimestre/semestre/año/año anterior
  const since = new Date()
  since.setDate(since.getDate() - 400)
  const sinceISO = since.toISOString()

  let registros: HistorialLead[] = []
  let members:   TeamMember[]    = []
  let contacts:  Contact[]       = []
  let deals:     Deal[]          = []
  let targets:   SalesTarget[]   = []

  if (isOwner) {
    const [{ data: hist }, { data: team }, { data: cont }, { data: dealsData }, { data: tgts }] = await Promise.all([
      supabase.from('historial_leads').select('*').eq('user_id', workspaceId).gte('fecha', sinceISO).order('fecha', { ascending: false }),
      supabase.from('team_members').select('*').eq('owner_id', workspaceId).eq('status', 'activo').order('name'),
      supabase.from('contacts').select('*').eq('user_id', workspaceId),
      supabase.from('deals').select('*').eq('user_id', workspaceId),
      supabase.from('sales_targets').select('*').eq('owner_id', workspaceId),
    ])
    registros = (hist      as HistorialLead[]) ?? []
    members   = (team      as TeamMember[])    ?? []
    contacts  = (cont      as Contact[])       ?? []
    deals     = (dealsData as Deal[])          ?? []
    targets   = (tgts      as SalesTarget[])   ?? []
  } else {
    const { data: myContacts } = await supabase.from('contacts').select('*').eq('user_id', workspaceId)
    contacts = (myContacts as Contact[]) ?? []
    const contactIds = contacts.map(c => c.id)

    if (contactIds.length > 0) {
      const [{ data: hist }, { data: dealsData }] = await Promise.all([
        supabase.from('historial_leads').select('*').eq('user_id', workspaceId).in('contact_id', contactIds).gte('fecha', sinceISO).order('fecha', { ascending: false }),
        supabase.from('deals').select('*').eq('user_id', workspaceId).eq('assigned_to', user.id),
      ])
      registros = (hist      as HistorialLead[]) ?? []
      deals     = (dealsData as Deal[])          ?? []
    }
  }

  return (
    <>
      <Topbar crumbs={[{ label: 'Gestión Vendedores' }]} />
      <div className="view">
        <GestionClient
          registros={registros}
          members={members}
          contacts={contacts}
          deals={deals}
          targets={targets}
          isOwner={isOwner}
          userId={workspaceId}
          currentUserId={user.id}
        />
      </div>
    </>
  )
}
