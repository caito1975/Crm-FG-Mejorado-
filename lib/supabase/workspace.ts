import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Returns the workspace owner's user_id for any authenticated user.
 * - If the user IS the owner → returns their own id
 * - If the user is a team member → returns the owner's id
 */
export async function getWorkspaceOwnerId(
  supabase: SupabaseClient,
  user: User,
): Promise<{ workspaceId: string; isOwner: boolean }> {
  const { data: linked } = await supabase
    .from('team_members')
    .select('owner_id')
    .eq('member_user_id', user.id)
    .maybeSingle()

  if (linked) return { workspaceId: linked.owner_id, isOwner: false }
  return { workspaceId: user.id, isOwner: true }
}

export interface AssignableMember {
  member_user_id: string
  name: string
  role: string
  team_member_id: string
}

/**
 * Returns active team members who have confirmed their account (member_user_id set).
 * Used to populate assignment dropdowns.
 */
export async function getAssignableMembers(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<AssignableMember[]> {
  const { data } = await supabase
    .from('team_members')
    .select('id, name, role, member_user_id')
    .eq('owner_id', workspaceId)
    .eq('status', 'activo')
    .not('member_user_id', 'is', null)
    .order('name')

  return (data ?? []).map(m => ({
    team_member_id: m.id,
    member_user_id: m.member_user_id,
    name: m.name,
    role: m.role,
  }))
}
