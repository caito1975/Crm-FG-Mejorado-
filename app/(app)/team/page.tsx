import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import TeamAdminClient from '@/components/team/TeamAdminClient'
import type { TeamMember, Deal } from '@/lib/types'

export default async function TeamPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId, isOwner } = await getWorkspaceOwnerId(supabase, user)

  const [{ data: members }, { data: deals }] = await Promise.all([
    supabase.from('team_members').select('*').eq('owner_id', workspaceId).order('created_at'),
    supabase.from('deals').select('*').eq('user_id', workspaceId),
  ])

  return (
    <>
      <Topbar crumbs={[{ label: 'Equipo' }]} />
      <div className="view">
        <TeamAdminClient
          members={(members as TeamMember[]) ?? []}
          deals={(deals as Deal[]) ?? []}
          userId={workspaceId}
          isOwner={isOwner}
        />
      </div>
    </>
  )
}
