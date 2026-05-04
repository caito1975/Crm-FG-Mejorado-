import { NextResponse } from 'next/server'
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

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'google_calendar')
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'Google Calendar no conectado' }, { status: 400 })
  }

  // Refresh token if expired
  let accessToken = integration.access_token
  if (new Date(integration.token_expiry) <= new Date()) {
    const refreshed = await refreshAccessToken(integration)
    if (!refreshed.access_token) {
      return NextResponse.json({ error: 'Token expirado, reconectá Calendar' }, { status: 401 })
    }
    accessToken = refreshed.access_token
    const service = createServiceClient()
    await service.from('integrations').update({
      access_token: accessToken,
      token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }).eq('id', integration.id)
  }

  // Fetch events for the next 14 days
  const now      = new Date().toISOString()
  const in14days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const eventsRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${in14days}&maxResults=30&singleEvents=true&orderBy=startTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const { items = [] } = await eventsRes.json()

  let synced = 0
  const service = createServiceClient()

  for (const event of items as any[]) {
    if (event.status === 'cancelled') continue

    const startDate = event.start?.dateTime ?? event.start?.date
    const title     = event.summary ?? 'Evento de calendario'
    const dueLabel  = startDate
      ? new Date(startDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : null

    await service.from('tasks').upsert(
      {
        user_id:     user.id,
        title,
        due_label:   dueLabel,
        due_date:    startDate ?? null,
        priority:    'media',
        done:        false,
        task_type:   'meeting',
        external_id: `gcal:${event.id}`,
      },
      { onConflict: 'external_id', ignoreDuplicates: true }
    )
    synced++
  }

  return NextResponse.json({ synced })
}
