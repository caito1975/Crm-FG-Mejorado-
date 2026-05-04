import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Returns the workspace owner's user_id for any authenticated user.
 * - If the user IS the owner → returns their own id
 * - If the user is a team member → returns the owner's id and auto-links if needed
 */
export async function getWorkspaceOwnerId(
  supabase: SupabaseClient,
  user: User,
): Promise<{ workspaceId: string; isOwner: boolean }> {
  // Already linked as a team member?
  const { data: linked } = await supabase
    .from('team_members')
    .select('owner_id')
    .eq('member_user_id', user.id)
    .maybeSingle()

  if (linked) return { workspaceId: linked.owner_id, isOwner: false }

  // No link yet — owner
  return { workspaceId: user.id, isOwner: true }
}
