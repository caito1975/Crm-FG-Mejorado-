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
  let teamStats: VendorStat[] = []
  let vendorName: string | null = null

  if (isOwner) {
    const { data: members } = await supabase
      .from('team_members')
      .select('member_user_id, name')
      .eq('owner_id', workspaceId)
      .eq('status', 'activo')
      .not('member_user_id', 'is', null)
      .order('name')

    const allContacts = (contacts as Contact[]) ?? []
    const allDeals    = (deals as Deal[]) ?? []

    const buildStat = (memberId: string, name: string): VendorStat => {
      const mContacts   = allContacts.filter(c => c.assigned_to === memberId)
      const mDeals      = allDeals.filter(d => d.assigned_to === memberId)
      const activeDeals = mDeals.filter(d => d.stage_id !== 'ganado' && d.stage_id !== 'perdido')
      const wonDeals    = mDeals.filter(d => d.stage_id === 'ganado')
      return {
        member_user_id: memberId,
        name,
        leads:        mContacts.length,
        active_deals: activeDeals.length,
        pipeline:     activeDeals.reduce((s, d) => s + d.amount, 0),
        won:          wonDeals.length,
      }
    }

    const vendorStats  = (members ?? []).map(m => buildStat(m.member_user_id, m.name))
    // Include owner's own assigned leads in the team stats
    const ownerAssigned = allContacts.filter(c => c.assigned_to === workspaceId)
    const ownerStat     = ownerAssigned.length > 0 ? buildStat(workspaceId, `${userName} (yo)`) : null
    teamStats = [...(ownerStat ? [ownerStat] : []), ...vendorStats]
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
          teamStats={teamStats}
          initialContacts={(contacts as Contact[]) ?? []}
          initialDeals={(deals as Deal[]) ?? []}
          initialTasks={(tasks as Task[]) ?? []}
          initialActivities={(activities as Activity[]) ?? []}
        />
      </div>
    </>
  )
}
