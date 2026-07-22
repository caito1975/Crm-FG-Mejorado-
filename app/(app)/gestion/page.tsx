import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import GestionClient from '@/components/gestion/GestionClient'
import type { TeamMember, HistorialLead } from '@/lib/types'

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
  let members: TeamMember[] = []

  if (isOwner) {
    const [{ data: hist }, { data: team }] = await Promise.all([
      supabase
        .from('historial_leads')
        .select('*')
        .eq('user_id', workspaceId)
        .gte('fecha', sinceISO)
        .order('fecha', { ascending: false }),
      supabase
        .from('team_members')
        .select('*')
        .eq('owner_id', workspaceId)
        .eq('status', 'activo')
        .order('name'),
    ])
    registros = (hist as HistorialLead[]) ?? []
    members   = (team as TeamMember[])   ?? []
  } else {
    // Vendor: scope to their assigned contacts
    const { data: myContacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', workspaceId)

    const contactIds = (myContacts ?? []).map((c: { id: string }) => c.id)

    if (contactIds.length > 0) {
      const { data: hist } = await supabase
        .from('historial_leads')
        .select('*')
        .eq('user_id', workspaceId)
        .in('contact_id', contactIds)
        .gte('fecha', sinceISO)
        .order('fecha', { ascending: false })
      registros = (hist as HistorialLead[]) ?? []
    }
  }

  return (
    <>
      <Topbar crumbs={[{ label: 'Gestión Vendedores' }]} />
      <div className="view">
        <GestionClient
          registros={registros}
          members={members}
          isOwner={isOwner}
          userId={workspaceId}
          currentUserId={user.id}
        />
      </div>
    </>
  )
}
