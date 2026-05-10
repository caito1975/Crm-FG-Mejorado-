import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import TeamAdminClient from '@/components/team/TeamAdminClient'
import type { TeamMember, Deal } from '@/lib/types'

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

export default async function TeamPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId, isOwner } = await getWorkspaceOwnerId(supabase, user)

  if (!isOwner) redirect('/dashboard')

  // Use service role to bypass RLS — page is owner-only, already verified above
  const admin = createAdminClient()
  const [{ data: members }, { data: deals }] = await Promise.all([
    admin.from('team_members').select('*').eq('owner_id', workspaceId).order('created_at'),
    admin.from('deals').select('*').eq('user_id', workspaceId),
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
