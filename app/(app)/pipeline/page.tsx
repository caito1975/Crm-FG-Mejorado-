import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import KanbanBoardClient from '@/components/pipeline/KanbanBoardClient'
import type { Deal, PipelineStage, Contact } from '@/lib/types'
import { DEFAULT_STAGES } from '@/lib/types'

export default async function PipelinePage({ searchParams }: { searchParams?: { mine?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId, isOwner } = await getWorkspaceOwnerId(supabase, user)

  // ?mine=1 → owner sees only their own assigned deals
  const mineOnly = isOwner && searchParams?.mine === '1'

  let dealsQuery = supabase.from('deals').select('*, contact:contacts(id,name,company)').eq('user_id', workspaceId)
  if (mineOnly) dealsQuery = dealsQuery.eq('assigned_to', user.id)

  const [
    { data: stages },
    { data: deals },
    { data: contacts },
  ] = await Promise.all([
    supabase.from('pipeline_stages').select('*').eq('user_id', workspaceId).order('position'),
    dealsQuery,
    supabase.from('contacts').select('id,name,company').eq('user_id', workspaceId).order('name'),
  ])

  let effectiveStages = stages as PipelineStage[]
  if (!effectiveStages || effectiveStages.length === 0) {
    const defaultStages = DEFAULT_STAGES.map(s => ({ ...s, user_id: workspaceId }))
    await supabase.from('pipeline_stages').upsert(defaultStages, { onConflict: 'id,user_id' })
    effectiveStages = defaultStages as PipelineStage[]
  }

  return (
    <div className="view flush" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <KanbanBoardClient
        userId={workspaceId}
        isOwner={isOwner}
        vendorAuthId={isOwner ? undefined : user.id}
        mineFilter={mineOnly ? user.id : undefined}
        stages={effectiveStages}
        initialDeals={(deals as Deal[]) ?? []}
        contacts={(contacts as Pick<Contact, 'id' | 'name' | 'company'>[]) ?? []}
      />
    </div>
  )
}
