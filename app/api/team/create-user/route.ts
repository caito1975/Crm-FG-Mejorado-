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

  const { email, password, member_id } = await req.json()
  if (!email || !password || !member_id) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'Mínimo 6 caracteres' }, { status: 400 })

  const admin = createAdminClient()

  // Create auth user with confirmed email — no invite email sent
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })

  // Link auth user to team_members record
  await admin
    .from('team_members')
    .update({ member_user_id: created.user.id, status: 'activo' })
    .eq('id', member_id)

  return NextResponse.json({ ok: true, user_id: created.user.id })
}
