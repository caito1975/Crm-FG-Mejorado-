import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { member_id, password } = await req.json()
  if (!member_id || !password) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'Mínimo 6 caracteres' }, { status: 400 })

  const admin = createAdminClient()

  // Get member_user_id from team_members
  const { data: member, error: memberErr } = await admin
    .from('team_members')
    .select('member_user_id, email, name')
    .eq('id', member_id)
    .single()

  if (memberErr || !member) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })

  let authUserId: string | null = member.member_user_id ?? null

  // If member_user_id not linked yet, look up by email
  if (!authUserId && member.email) {
    const { data: list } = await admin.auth.admin.listUsers()
    const found = list?.users?.find((u: any) => u.email === member.email)
    if (found) authUserId = found.id
  }

  if (!authUserId) {
    // Auth user doesn't exist yet — create it now
    if (!member.email) {
      return NextResponse.json({ error: 'El miembro no tiene email asignado' }, { status: 400 })
    }
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: member.email,
      password,
      email_confirm: true,
    })
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })
    authUserId = created.user.id
    await admin.from('team_members').update({ member_user_id: authUserId, status: 'activo' }).eq('id', member_id)
    return NextResponse.json({ ok: true, created: true })
  }

  const { error } = await admin.auth.admin.updateUserById(authUserId, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
