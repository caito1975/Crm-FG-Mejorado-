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

  const { workspaceId } = await getWorkspaceOwnerId(supabase, user)

  const { data } = await supabase
    .from('historial_leads')
    .select('*')
    .eq('user_id', workspaceId)
    .order('fecha', { ascending: false })

  return (
    <>
      <Topbar crumbs={[{ label: 'Historial de Leads' }]} />
      <div className="view">
        <HistorialClient registros={(data as HistorialLead[]) ?? []} />
      </div>
    </>
  )
}
