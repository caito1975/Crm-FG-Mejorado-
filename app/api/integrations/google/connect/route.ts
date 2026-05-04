import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SCOPES: Record<string, string[]> = {
  gmail: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.readonly',
  ],
  google_calendar: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar.readonly',
  ],
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const provider = req.nextUrl.searchParams.get('provider')
  if (!provider || !SCOPES[provider]) {
    return NextResponse.json({ error: 'Provider inválido' }, { status: 400 })
  }

  const base = `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const redirectUri = `${base}/api/integrations/google/callback`
  console.log('🔑 redirect_uri enviado a Google:', redirectUri)

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         SCOPES[provider].join(' '),
    access_type:   'offline',
    prompt:        'consent',
    state:         `${user.id}:${provider}`,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  )
}
