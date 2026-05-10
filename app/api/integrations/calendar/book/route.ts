import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

async function refreshToken(integration: any): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: integration.refresh_token,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  return data.access_token ?? null
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function parseSlotKey(key: string): { start: Date; label: string } | null {
  const m = key.match(/^SLOT_(\d{4})-(\d{2})-(\d{2})_(\d{2}):00$/)
  if (!m) return null
  const [, y, mo, d, h] = m.map(Number)
  // ART (UTC-3) → UTC: add 3 hours
  const start  = new Date(Date.UTC(y, mo - 1, d, h + 3, 0, 0, 0))
  const artDOW = new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
  const label  = `${DAY_NAMES[artDOW]} ${String(d).padStart(2,'0')}/${String(mo).padStart(2,'0')} · ${String(h).padStart(2,'0')}:00hs`
  return { start, label }
}

export async function POST(req: NextRequest) {
  const { user_id, slot_key, contact_name, contact_phone, contact_id } = await req.json()
  if (!user_id || !slot_key) return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })

  const parsed = parseSlotKey(slot_key)
  if (!parsed) return NextResponse.json({ error: 'slot_key inválido' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', user_id)
    .eq('provider', 'google_calendar')
    .maybeSingle()

  if (!integration) {
    return NextResponse.json({ error: 'Google Calendar no conectado' }, { status: 404 })
  }

  let accessToken: string | null = integration.access_token
  if (new Date(integration.token_expiry) <= new Date()) {
    const newToken = await refreshToken(integration)
    if (newToken) {
      accessToken = newToken
      await supabase.from('integrations').update({
        access_token: newToken,
        token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
      }).eq('id', integration.id)
    } else {
      accessToken = null
    }
  }

  const { start, label } = parsed
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  let eventId:  string | null = null
  let meetLink: string | null = null

  if (accessToken) {
    const event = {
      summary:     `Reunión FG Medios${contact_name ? ` — ${contact_name}` : ''}`,
      description: [
        'Reunión agendada vía CRM CarosIA',
        contact_name  ? `Contacto: ${contact_name}`   : '',
        contact_phone ? `Teléfono: ${contact_phone}` : '',
      ].filter(Boolean).join('\n'),
      start: { dateTime: start.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
      end:   { dateTime: end.toISOString(),   timeZone: 'America/Argentina/Buenos_Aires' },
      conferenceData: {
        createRequest: {
          requestId: `crm-meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }

    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(event),
      }
    )

    if (calRes.ok) {
      const created = await calRes.json()
      eventId  = created.id ?? null
      meetLink = created.conferenceData?.entryPoints
        ?.find((e: any) => e.entryPointType === 'video')?.uri ?? null
    }
    // If Calendar API fails, continue — confirmation is sent without meet link
  }
  // If token unavailable, confirm booking without creating calendar event

  if (contact_id) {
    await supabase.from('activities').insert({
      user_id,
      kind:       'meeting',
      who:        contact_name ?? '',
      body:       `Reunión agendada: ${label}${meetLink ? ` — ${meetLink}` : ''}`,
      contact_id,
    })
  }

  return NextResponse.json({
    ok:         true,
    event_id:   eventId,
    slot_label: label,
    start_iso:  start.toISOString(),
    meet_link:  meetLink,
  })
}
