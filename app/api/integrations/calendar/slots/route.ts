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

const DAY_NAMES  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
// Available hours in ART (UTC-3) — skip lunch 12-13
const SLOT_HOURS = [10, 11, 14, 15, 16, 17]
const DAYS_AHEAD = 7
const MAX_SLOTS  = 8

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  if (!user_id) return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })

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

  let accessToken = integration.access_token
  if (new Date(integration.token_expiry) <= new Date()) {
    const newToken = await refreshToken(integration)
    if (!newToken) return NextResponse.json({ error: 'Token expirado, reconectar Google Calendar' }, { status: 401 })
    accessToken = newToken
    await supabase.from('integrations').update({
      access_token: newToken,
      token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
    }).eq('id', integration.id)
  }

  // Search window: from next full hour to DAYS_AHEAD days ahead
  const timeMin = new Date()
  timeMin.setUTCMinutes(0, 0, 0)
  timeMin.setUTCHours(timeMin.getUTCHours() + 1)
  const timeMax = new Date(timeMin.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000)

  const fbRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: 'America/Argentina/Buenos_Aires',
      items: [{ id: 'primary' }],
    }),
  })

  if (!fbRes.ok) {
    return NextResponse.json({ error: 'Error al consultar disponibilidad' }, { status: 500 })
  }

  const fbData = await fbRes.json()
  const busyPeriods: { start: Date; end: Date }[] =
    (fbData.calendars?.primary?.busy ?? []).map((b: any) => ({
      start: new Date(b.start),
      end:   new Date(b.end),
    }))

  const slots: { key: string; label: string; start_iso: string }[] = []
  const cursor = new Date(timeMin)

  while (slots.length < MAX_SLOTS && cursor < timeMax) {
    // Convert UTC cursor to ART (UTC-3) for business-hour check
    const artDate = new Date(cursor.getTime() - 3 * 60 * 60 * 1000)
    const artHour = artDate.getUTCHours()
    const artDOW  = artDate.getUTCDay()
    const artDay  = artDate.getUTCDate()
    const artMon  = artDate.getUTCMonth() + 1
    const artYear = artDate.getUTCFullYear()

    if (artDOW !== 0 && SLOT_HOURS.includes(artHour)) {
      const slotEnd = new Date(cursor.getTime() + 60 * 60 * 1000)
      const isBusy  = busyPeriods.some(b => cursor < b.end && slotEnd > b.start)

      if (!isBusy) {
        const dd = artDay.toString().padStart(2, '0')
        const mm = artMon.toString().padStart(2, '0')
        const hh = artHour.toString().padStart(2, '0')
        slots.push({
          key:       `SLOT_${artYear}-${mm}-${dd}_${hh}:00`,
          label:     `${DAY_NAMES[artDOW]} ${dd}/${mm} · ${hh}:00hs`,
          start_iso: cursor.toISOString(),
        })
      }
    }

    cursor.setUTCHours(cursor.getUTCHours() + 1)
  }

  return NextResponse.json({ slots })
}
