import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId, contactId, contactName, contactCompany, newVendorId, newVendorName, prevVendorId } = body

  if (!userId || !contactId || !newVendorId || newVendorId === prevVendorId) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const supabase = serviceClient()

  // Obtener todas las stages del workspace y elegir la primera activa
  const { data: allStages, error: stagesError } = await supabase
    .from('pipeline_stages')
    .select('id, position')
    .eq('user_id', userId)
    .order('position')

  if (stagesError) {
    console.error('[assign-lead] stages error:', stagesError.message)
  }

  const firstStageId = allStages
    ?.filter(s => s.id !== 'ganado' && s.id !== 'perdido')
    ?.[0]?.id ?? 'enviado'

  console.log('[assign-lead] contactId:', contactId, '| vendor:', newVendorName, '| stage:', firstStageId)

  // Deal: reasignar activo o crear nuevo
  const { data: existingDeals, error: dealsError } = await supabase
    .from('deals')
    .select('id')
    .eq('contact_id', contactId)
    .neq('stage_id', 'ganado')
    .neq('stage_id', 'perdido')
    .limit(1)

  if (dealsError) console.error('[assign-lead] existing deals error:', dealsError.message)

  if (existingDeals && existingDeals.length > 0) {
    const { error } = await supabase
      .from('deals')
      .update({ assigned_to: newVendorId, owner_name: newVendorName })
      .eq('id', existingDeals[0].id)
    if (error) console.error('[assign-lead] update deal error:', error.message)
    else console.log('[assign-lead] updated existing deal:', existingDeals[0].id)
  } else {
    const { data: newDeal, error } = await supabase.from('deals').insert({
      user_id:     userId,
      title:       `Lead: ${contactName}`,
      contact_id:  contactId,
      stage_id:    firstStageId,
      amount:      0,
      probability: 20,
      owner_name:  newVendorName,
      assigned_to: newVendorId,
    }).select('id').single()
    if (error) console.error('[assign-lead] insert deal error:', error.message, error.details)
    else console.log('[assign-lead] created deal:', newDeal?.id, 'stage:', firstStageId)
  }

  // Inbox: mensaje visible al vendedor via filtro from_name
  const { error: inboxErr } = await supabase.from('inbox_messages').insert({
    user_id:    userId,
    from_name:  contactName,
    subject:    `Lead asignado: ${contactName}`,
    preview:    `Asignado a ${newVendorName}${contactCompany ? ` · ${contactCompany}` : ''}`,
    body:       `Nuevo lead asignado a ${newVendorName}${contactCompany ? ` · ${contactCompany}` : ''}`,
    sent_label: 'Ahora',
    unread:     true,
    starred:    false,
    labels:     [],
  })
  if (inboxErr) console.error('[assign-lead] inbox error:', inboxErr.message)

  return NextResponse.json({ ok: true, stage: firstStageId })
}
