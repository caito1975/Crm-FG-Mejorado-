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

// RFC 2047: encode subject for non-ASCII characters (accents, ñ, etc.)
function encodeSubject(subject: string): string {
  if (/[^\x00-\x7F]/.test(subject)) {
    return `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`
  }
  return subject
}

// Convert plain text to HTML: newlines → <br>, image URLs → <img>, links → <a>
function textToHtml(text: string): string {
  const imageExtRe = /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?\S*)?/gi
  const urlRe      = /https?:\/\/\S+/gi

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(imageExtRe, url =>
      `<img src="${url}" alt="" style="max-width:100%;height:auto;display:block;margin:8px 0" />`
    )
    .replace(urlRe, url =>
      `<a href="${url}" style="color:#4f6ef7">${url}</a>`
    )
    .replace(/\n/g, '<br />')
}

function buildMimeMessage(from: string, to: string, subject: string, body: string): string {
  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#222">${textToHtml(body)}</body></html>`

  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody, 'utf-8').toString('base64'),
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

  const displayName   = user.user_metadata?.crm_display_name || user.user_metadata?.full_name || ''
  const senderEmail   = user.user_metadata?.crm_sender_email || integration.email
  const fromField     = displayName ? `${displayName} <${senderEmail}>` : senderEmail
  const raw = buildMimeMessage(fromField, to, subject, body)

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
