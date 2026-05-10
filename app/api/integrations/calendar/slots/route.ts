import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

async function refreshToken(integration: any): Promise<{ token: string | null; error?: string }> {
  try {
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
    if (data.error) return { token: null, error: `OAuth error: ${data.error} - ${data.error_description ?? ''}` }
    return { token: data.access_token ?? null }
  } catch (e: any) {
    return { token: null, error: `Refresh fetch failed: ${e.message}` }
  }
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

  // Search window: from next full hour to DAYS_AHEAD days ahead
  const timeMin = new Date()
  timeMin.setUTCMinutes(0, 0, 0)
  timeMin.setUTCHours(timeMin.getUTCHours() + 1)
  const timeMax = new Date(timeMin.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000)

  let busyPeriods: { start: Date; end: Date }[] = []

  // Try to use Google Calendar to filter busy slots; fall back to open schedule if unavailable
  let accessToken: string | null = integration.access_token
  if (new Date(integration.token_expiry) <= new Date()) {
    const { token: newToken } = await refreshToken(integration)
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

  if (accessToken) {
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

    if (fbRes.ok) {
      const fbData = await fbRes.json()
      busyPeriods = (fbData.calendars?.primary?.busy ?? []).map((b: any) => ({
        start: new Date(b.start),
        end:   new Date(b.end),
      }))
    }
    // If FreeBusy call fails, continue with empty busyPeriods (no filtering)
  }
  // If token unavailable, continue with empty busyPeriods (show all business-hour slots)

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
