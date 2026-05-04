import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

function baseUrl(req: NextRequest) {
  return `${req.nextUrl.protocol}//${req.nextUrl.host}`
}

export async function GET(req: NextRequest) {
  const base     = baseUrl(req)
  const code     = req.nextUrl.searchParams.get('code')
  const state    = req.nextUrl.searchParams.get('state')
  const errorMsg = req.nextUrl.searchParams.get('error')

  if (errorMsg || !code || !state) {
    return NextResponse.redirect(`${base}/settings?tab=integraciones&error=1`)
  }

  const parts    = state.split(':')
  const userId   = parts[0]
  const provider = parts.slice(1).join(':') // handles 'google_calendar'
  if (!userId || !provider) {
    return NextResponse.redirect(`${base}/settings?tab=integraciones&error=1`)
  }

  try {
    // Exchange code → tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri:  `${base}/api/integrations/google/callback`,
        grant_type:    'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokenRes.ok || !tokens.access_token) {
      console.error('Token exchange failed:', tokens)
      return NextResponse.redirect(`${base}/settings?tab=integraciones&error=1`)
    }

    // Get Google account email
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = await userInfoRes.json()

    const supabase = createServiceClient()
    const { error: upsertError } = await supabase.from('integrations').upsert(
      {
        user_id:       userId,
        provider,
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expiry:  new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
        email:         userInfo.email ?? null,
        connected_at:  new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' }
    )

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError)
      return NextResponse.redirect(`${base}/settings?tab=integraciones&error=1`)
    }

    return NextResponse.redirect(`${base}/settings?tab=integraciones&connected=${provider}`)
  } catch (err) {
    console.error('Callback error:', err)
    return NextResponse.redirect(`${base}/settings?tab=integraciones&error=1`)
  }
}
