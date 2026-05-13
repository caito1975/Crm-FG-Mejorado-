import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role bypasa RLS — operación interna segura
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { userId, contactId, contactName, contactCompany, newVendorId, newVendorName, prevVendorId } =
    await req.json()

  if (!userId || !contactId || !newVendorId || newVendorId === prevVendorId) {
    return NextResponse.json({ ok: true })
  }

  const supabase = serviceClient()

  // Obtener la primera etapa activa del workspace (excluyendo ganado/perdido)
  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('user_id', userId)
    .not('id', 'in', '(ganado,perdido)')
    .order('position')
    .limit(1)
    .single()

  const stageId = firstStage?.id ?? 'contactar'

  // Deal: reasignar activo o crear nuevo
  const { data: existingDeals } = await supabase
    .from('deals')
    .select('id')
    .eq('contact_id', contactId)
    .neq('stage_id', 'ganado')
    .neq('stage_id', 'perdido')
    .limit(1)

  if (existingDeals && existingDeals.length > 0) {
    const { error } = await supabase
      .from('deals')
      .update({ assigned_to: newVendorId, owner_name: newVendorName })
      .eq('id', existingDeals[0].id)
    if (error) console.error('[assign-lead] update deal error:', error.message)
  } else {
    const { error } = await supabase.from('deals').insert({
      user_id:     userId,
      title:       `Lead: ${contactName}`,
      contact_id:  contactId,
      stage_id:    stageId,
      amount:      0,
      probability: 20,
      owner_name:  newVendorName,
      assigned_to: newVendorId,
    })
    if (error) console.error('[assign-lead] insert deal error:', error.message)
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
  if (inboxErr) console.error('[assign-lead] insert inbox error:', inboxErr.message)

  return NextResponse.json({ ok: true })
}
