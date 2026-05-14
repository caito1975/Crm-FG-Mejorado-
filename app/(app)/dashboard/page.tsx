import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkspaceOwnerId } from '@/lib/supabase/workspace'
import Topbar from '@/components/layout/Topbar'
import DashboardClient from '@/components/dashboard/DashboardClient'
import type { Contact, Deal, Task, Activity } from '@/lib/types'

export interface VendorStat {
  member_user_id: string
  name: string
  leads: number
  active_deals: number
  pipeline: number
  won: number
}

export interface WorkspaceMember {
  member_user_id: string
  name: string
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { workspaceId, isOwner } = await getWorkspaceOwnerId(supabase, user)

  const [
    { data: contacts },
    { data: deals },
    { data: tasks },
    { data: activities },
  ] = await Promise.all([
    isOwner
      ? supabase.from('contacts').select('*').eq('user_id', workspaceId).order('created_at', { ascending: false })
      : supabase.from('contacts').select('*').eq('user_id', workspaceId).eq('assigned_to', user.id).order('created_at', { ascending: false }),
    isOwner
      ? supabase.from('deals').select('*, contact:contacts(id,name,company)').eq('user_id', workspaceId)
      : supabase.from('deals').select('*, contact:contacts(id,name,company)').eq('user_id', workspaceId).eq('assigned_to', user.id),
    supabase.from('tasks').select('*, contact:contacts(id,name,company)').eq('user_id', workspaceId).order('created_at', { ascending: false }),
    supabase.from('activities').select('*, contact:contacts(id,name,company)').eq('user_id', workspaceId).order('created_at', { ascending: false }).limit(10),
  ])

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'

  // ── Build per-vendor stats (owner sees team + themselves) ───────────────────
  let workspaceMembers: WorkspaceMember[] = []
  let ownerMember: WorkspaceMember | null = null
  let vendorName: string | null = null

  if (isOwner) {
    const { data: members } = await supabase
      .from('team_members')
      .select('member_user_id, name')
      .eq('owner_id', workspaceId)
      .eq('status', 'activo')
      .not('member_user_id', 'is', null)
      .order('name')

    workspaceMembers = (members ?? []) as WorkspaceMember[]

    // Include owner if they have contacts assigned to themselves
    const allContacts = (contacts as Contact[]) ?? []
    const ownerAssigned = allContacts.filter(c => c.assigned_to === workspaceId)
    if (ownerAssigned.length > 0) {
      ownerMember = { member_user_id: workspaceId, name: `${userName} (yo)` }
    }
  } else {
    // Vendor: resolve their display name
    const { data: member } = await supabase
      .from('team_members')
      .select('name')
      .eq('member_user_id', user.id)
      .maybeSingle()
    vendorName = member?.name ?? userName
  }

  return (
    <>
      <Topbar
        crumbs={[{ label: 'Dashboard' }]}
        actions={
          <>
            <button className="btn"><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Última semana</span></button>
            {isOwner && <button className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>+ Nuevo deal</button>}
          </>
        }
      />
      <div className="view">
        <DashboardClient
          userId={workspaceId}
          currentUserId={user.id}
          userName={userName}
          isOwner={isOwner}
          vendorName={vendorName}
          workspaceMembers={workspaceMembers}
          ownerMember={ownerMember}
          initialContacts={(contacts as Contact[]) ?? []}
          initialDeals={(deals as Deal[]) ?? []}
          initialTasks={(tasks as Task[]) ?? []}
          initialActivities={(activities as Activity[]) ?? []}
        />
      </div>
    </>
  )
}
