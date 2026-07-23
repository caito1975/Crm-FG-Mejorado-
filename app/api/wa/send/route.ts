import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'

const EVO_URL      = process.env.EVOLUTION_API_URL      ?? 'https://fgmedios-evolution-api.aibo5u.easypanel.host'
const EVO_KEY      = process.env.EVOLUTION_API_KEY      ?? '429683C4C977415CAAFCCE10F7D57E11'
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE     ?? 'carosia-crm'

function serviceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { phone, message, contact_id } = await req.json()
  if (!phone || !message) return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })

  const phoneRaw = phone.replace(/\D/g, '')
  const waNumber = phoneRaw.length === 10 ? '549' + phoneRaw : phoneRaw

  const evoRes = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body:    JSON.stringify({ number: waNumber, text: message }),
  })

  if (!evoRes.ok) {
    const errText = await evoRes.text()
    let friendlyError = 'Error al enviar WhatsApp.'
    try {
      const errJson = JSON.parse(errText)
      const msg = errJson?.response?.message ?? errJson?.error ?? ''
      if (/connection closed/i.test(msg) || /closed/i.test(msg)) {
        friendlyError = 'WhatsApp desconectado. Reconectá la instancia en el panel de Evolution API.'
      } else if (/not found/i.test(msg) || /instance/i.test(msg)) {
        friendlyError = 'Instancia de WhatsApp no encontrada. Verificá la configuración.'
      } else if (msg) {
        friendlyError = msg
      }
    } catch { /* errText is not JSON */ }
    return NextResponse.json({ error: friendlyError }, { status: 500 })
  }

  const senderWa = user.user_metadata?.crm_wa || EVO_INSTANCE
  const svc = serviceClient()
  await svc.from('activities').insert({
    user_id:    user.id,
    kind:       'email_out',
    who:        `WA ${senderWa}`,
    body:       `[WA] ${message.substring(0, 200)}`,
    contact_id: contact_id ?? null,
  })

  return NextResponse.json({ ok: true })
}
