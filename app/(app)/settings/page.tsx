import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import SettingsClient from '@/components/settings/SettingsClient'
import type { PipelineStage } from '@/lib/types'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId } = await getWorkspaceOwnerId(supabase, user)

  const { data: stages } = await supabase
    .from('pipeline_stages').select('*').eq('user_id', workspaceId).order('position')

  return (
    <>
      <Topbar crumbs={[{ label: 'Configuración' }]} />
      <div className="view">
        <SettingsClient
          userId={workspaceId}
          authUserId={user.id}
          userEmail={user.email ?? ''}
          stages={(stages as PipelineStage[]) ?? []}
        />
      </div>
    </>
  )
}
