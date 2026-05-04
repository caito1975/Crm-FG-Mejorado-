import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import ReportsClient from '@/components/reports/ReportsClient'
import type { Deal, Contact, PipelineStage } from '@/lib/types'

export default async function ReportsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId } = await getWorkspaceOwnerId(supabase, user)

  const [{ data: deals }, { data: contacts }, { data: stages }] = await Promise.all([
    supabase.from('deals').select('*, contact:contacts(company, rubro, owner_name)').eq('user_id', workspaceId),
    supabase.from('contacts').select('*').eq('user_id', workspaceId),
    supabase.from('pipeline_stages').select('*').eq('user_id', workspaceId).order('position'),
  ])

  return (
    <>
      <Topbar crumbs={[{ label: 'Reportes' }]} />
      <div className="view">
        <ReportsClient
          deals={(deals as Deal[]) ?? []}
          contacts={(contacts as Contact[]) ?? []}
          stages={(stages as PipelineStage[]) ?? []}
        />
      </div>
    </>
  )
}
