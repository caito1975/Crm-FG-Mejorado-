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

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { title, due_date, contact_name, contact_id } = await req.json()
  if (!title || !due_date) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'google_calendar')
    .single()

  if (!integration) {
    return NextResponse.json({ ok: true, calendar: false, reason: 'sin_integracion' })
  }

  let accessToken = integration.access_token
  if (new Date(integration.token_expiry) <= new Date()) {
    const refreshed = await refreshAccessToken(integration)
    if (!refreshed.access_token) {
      return NextResponse.json({ ok: true, calendar: false, reason: 'token_expirado' })
    }
    accessToken = refreshed.access_token
    const service = createServiceClient()
    await service.from('integrations').update({
      access_token: accessToken,
      token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }).eq('id', integration.id)
  }

  const start = new Date(due_date)
  const end   = new Date(start.getTime() + 60 * 60 * 1000) // +1 hora

  const event = {
    summary:     contact_name ? `${title} — ${contact_name}` : title,
    description: contact_name ? `Tarea CRM · Contacto: ${contact_name}` : 'Tarea CRM',
    start: { dateTime: start.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
    end:   { dateTime: end.toISOString(),   timeZone: 'America/Argentina/Buenos_Aires' },
  }

  const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(event),
  })

  if (!calRes.ok) {
    const err = await calRes.json()
    const msg = err?.error?.message ?? 'Error al crear evento'
    if (msg.includes('insufficient') || calRes.status === 403) {
      return NextResponse.json({ ok: true, calendar: false, reason: 'sin_permiso' })
    }
    return NextResponse.json({ ok: true, calendar: false, reason: msg })
  }

  const created = await calRes.json()
  return NextResponse.json({ ok: true, calendar: true, eventId: created.id })
}
