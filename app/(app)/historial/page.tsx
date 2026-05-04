import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import HistorialClient from '@/components/historial/HistorialClient'
import type { HistorialLead } from '@/lib/types'

export default async function HistorialPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId, isOwner } = await getWorkspaceOwnerId(supabase, user)

  let registros: HistorialLead[] = []

  if (isOwner) {
    // Owner: todo el historial del workspace
    const { data } = await supabase
      .from('historial_leads')
      .select('*')
      .eq('user_id', workspaceId)
      .order('fecha', { ascending: false })
    registros = (data as HistorialLead[]) ?? []
  } else {
    // Vendor: solo historial de sus contactos asignados
    // RLS ya filtra contacts → solo devuelve los de este vendor
    const { data: myContacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', workspaceId)

    const contactIds = (myContacts ?? []).map((c: { id: string }) => c.id)

    if (contactIds.length > 0) {
      const { data } = await supabase
        .from('historial_leads')
        .select('*')
        .eq('user_id', workspaceId)
        .in('contact_id', contactIds)
        .order('fecha', { ascending: false })
      registros = (data as HistorialLead[]) ?? []
    }
  }

  return (
    <>
      <Topbar crumbs={[{ label: 'Historial de Leads' }]} />
      <div className="view">
        <HistorialClient registros={registros} />
      </div>
    </>
  )
}
