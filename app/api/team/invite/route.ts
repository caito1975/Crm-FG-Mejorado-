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
  const supabase      = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${req.nextUrl.protocol}//${req.nextUrl.host}/login`,
  })

  if (error) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
