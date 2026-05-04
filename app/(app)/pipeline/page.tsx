import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import KanbanBoardClient from '@/components/pipeline/KanbanBoardClient'
import type { Deal, PipelineStage, Contact } from '@/lib/types'
import { DEFAULT_STAGES } from '@/lib/types'

export default async function PipelinePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: stages },
    { data: deals },
    { data: contacts },
  ] = await Promise.all([
    supabase.from('pipeline_stages').select('*').eq('user_id', user.id).order('position'),
    supabase.from('deals').select('*, contact:contacts(id,name,company)').eq('user_id', user.id),
    supabase.from('contacts').select('id,name,company').eq('user_id', user.id).order('name'),
  ])

  // If no stages yet, seed them (first login fallback)
  let effectiveStages = stages as PipelineStage[]
  if (!effectiveStages || effectiveStages.length === 0) {
    const defaultStages = DEFAULT_STAGES.map(s => ({ ...s, user_id: user.id }))
    await supabase.from('pipeline_stages').upsert(defaultStages, { onConflict: 'id,user_id' })
    effectiveStages = defaultStages as PipelineStage[]
  }

  return (
    <div className="view flush" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <KanbanBoardClient
        userId={user.id}
        stages={effectiveStages}
        initialDeals={(deals as Deal[]) ?? []}
        contacts={(contacts as Pick<Contact, 'id' | 'name' | 'company'>[]) ?? []}
      />
    </div>
  )
}
