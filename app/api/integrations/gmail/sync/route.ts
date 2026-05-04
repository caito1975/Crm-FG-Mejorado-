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
    .eq('provider', 'gmail')
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'Gmail no conectado' }, { status: 400 })
  }

  // Refresh token if expired
  let accessToken = integration.access_token
  if (new Date(integration.token_expiry) <= new Date()) {
    const refreshed = await refreshAccessToken(integration)
    if (!refreshed.access_token) {
      return NextResponse.json({ error: 'Token expirado, reconectá Gmail' }, { status: 401 })
    }
    accessToken = refreshed.access_token
    const service = createServiceClient()
    await service.from('integrations').update({
      access_token: accessToken,
      token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }).eq('id', integration.id)
  }

  // Fetch last 20 inbox messages
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const { messages = [] } = await listRes.json()

  let synced = 0
  for (const msg of messages as { id: string }[]) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const msgData = await msgRes.json()
    const hdrs    = (msgData.payload?.headers ?? []) as { name: string; value: string }[]
    const from    = hdrs.find(h => h.name === 'From')?.value    ?? ''
    const subject = hdrs.find(h => h.name === 'Subject')?.value ?? '(sin asunto)'
    const snippet = (msgData.snippet ?? '').slice(0, 200)

    // Extract raw email from "Nombre <email@domain.com>"
    const emailMatch = from.match(/<([^>]+)>/)
    const senderEmail = emailMatch ? emailMatch[1].trim() : from.trim()

    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', user.id)
      .ilike('email', senderEmail)
      .maybeSingle()

    const service = createServiceClient()
    await service.from('activities').upsert(
      {
        user_id:     user.id,
        kind:        'email_in',
        who:         from,
        body:        `${subject}${snippet ? ' — ' + snippet : ''}`,
        contact_id:  contact?.id ?? null,
        external_id: `gmail:${msg.id}`,
      },
      { onConflict: 'external_id', ignoreDuplicates: true }
    )
    synced++
  }

  return NextResponse.json({ synced })
}
