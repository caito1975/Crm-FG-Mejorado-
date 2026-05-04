import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

async function refreshAccessToken(integration: any) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: integration.refresh_token,
      grant_type:    'refresh_token',
    }),
  })
  return res.json()
}

function buildMimeMessage(from: string, to: string, subject: string, body: string): string {
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n')

  return Buffer.from(mime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { to, subject, body, contact_id } = await req.json()
  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'gmail')
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'Gmail no conectado. Conectá tu cuenta en Configuración → Integraciones.' }, { status: 400 })
  }

  // Refresh token if expired
  let accessToken = integration.access_token
  if (new Date(integration.token_expiry) <= new Date()) {
    const refreshed = await refreshAccessToken(integration)
    if (!refreshed.access_token) {
      return NextResponse.json({ error: 'Token expirado. Reconectá Gmail en Configuración.' }, { status: 401 })
    }
    accessToken = refreshed.access_token
    const service = createServiceClient()
    await service.from('integrations').update({
      access_token: accessToken,
      token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }).eq('id', integration.id)
  }

  const raw = buildMimeMessage(integration.email, to, subject, body)

  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ raw }),
  })

  if (!sendRes.ok) {
    const err = await sendRes.json()
    const msg = err?.error?.message ?? 'Error al enviar'
    if (msg.includes('insufficient')) {
      return NextResponse.json({ error: 'Sin permiso de envío. Reconectá Gmail en Configuración → Integraciones.' }, { status: 403 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Log email_out activity
  const service = createServiceClient()
  await service.from('activities').insert({
    user_id:    user.id,
    kind:       'email_out',
    who:        integration.email,
    body:       `${subject}`,
    contact_id: contact_id ?? null,
  })

  return NextResponse.json({ ok: true })
}
