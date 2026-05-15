import type { SupabaseClient } from '@supabase/supabase-js'

// Status → stage mapping (only direct 1:1 mappings)
const STATUS_TO_STAGE: Record<string, string> = {
  contactar:   'contactar',
  contactado:  'contactado',
  interesado:  'interesado',
  enviado:     'enviado',
  oportunidad: 'oportunidad',
  cliente:     'ganado',
  archivado:   'perdido',
}

// Oportunidad sub-stages — don't override these when status='oportunidad'
const OPORTUNIDAD_STAGES = new Set(['oportunidad', 'reu_inicial', 'seg_reu', 'prop_enviada', 'doc_enviada', 'doc_firmada', 'ped_fc'])

export async function syncDealStageFromStatus(
  supabase: SupabaseClient,
  contactId: string,
  newStatus: string,
) {
  const targetStage = STATUS_TO_STAGE[newStatus]
  if (!targetStage) return // lead, no_enviado — no direct mapping, don't touch

  // Find the active deal for this contact
  const { data: activeDeal } = await supabase
    .from('deals')
    .select('id, stage_id')
    .eq('contact_id', contactId)
    .neq('stage_id', 'ganado')
    .neq('stage_id', 'perdido')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!activeDeal) return

  // Don't downgrade an oportunidad sub-stage back to 'oportunidad'
  if (newStatus === 'oportunidad' && OPORTUNIDAD_STAGES.has(activeDeal.stage_id)) return

  if (activeDeal.stage_id !== targetStage) {
    await supabase.from('deals').update({ stage_id: targetStage }).eq('id', activeDeal.id)
  }
}

export async function cascadeLeadAssignment(
  supabase: SupabaseClient,
  userId: string,
  contactId: string,
  contactName: string,
  contactCompany: string | null,
  newVendorId: string,
  newVendorName: string,
  prevVendorId: string | null,
  newContactStatus?: string,
) {
  if (!newVendorId || newVendorId === prevVendorId) return

  // Etapas activas del workspace (excluye terminales)
  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, position')
    .eq('user_id', userId)
    .order('position')

  const activeStages = stages?.filter(s => s.id !== 'ganado' && s.id !== 'perdido') ?? []
  const firstStageId = activeStages[0]?.id ?? 'enviado'

  // Si el nuevo estado del contacto coincide con un stage activo, usar ese stage
  const targetStageId = (newContactStatus && activeStages.some(s => s.id === newContactStatus))
    ? newContactStatus
    : firstStageId

  // Deal: garantizar exactamente 1 deal activo por contacto
  const { data: activeDeals } = await supabase
    .from('deals')
    .select('id, stage_id')
    .eq('contact_id', contactId)
    .neq('stage_id', 'ganado')
    .neq('stage_id', 'perdido')
    .order('created_at', { ascending: false })

  if (activeDeals && activeDeals.length > 1) {
    // Eliminar duplicados — conservar el más reciente
    const [keep, ...extras] = activeDeals
    const extraIds = extras.map(d => d.id)
    await supabase.from('deals').delete().in('id', extraIds)
    console.log('[cascade] duplicados eliminados:', extraIds)
    // Actualizar el que conservamos
    const { error } = await supabase
      .from('deals')
      .update({ assigned_to: newVendorId, owner_name: newVendorName, stage_id: targetStageId })
      .eq('id', keep.id)
    if (error) console.error('[cascade] update deal:', error.message)
    else console.log('[cascade] deal actualizado (dedup):', keep.id, 'stage:', targetStageId)
  } else if (activeDeals && activeDeals.length === 1) {
    const { error } = await supabase
      .from('deals')
      .update({ assigned_to: newVendorId, owner_name: newVendorName, stage_id: targetStageId })
      .eq('id', activeDeals[0].id)
    if (error) console.error('[cascade] update deal:', error.message)
    else console.log('[cascade] deal reasignado:', activeDeals[0].id, 'stage:', targetStageId)
  } else {
    const { data: newDeal, error } = await supabase
      .from('deals')
      .insert({
        user_id:     userId,
        title:       `Lead: ${contactName}`,
        contact_id:  contactId,
        stage_id:    targetStageId,
        amount:      0,
        probability: 20,
        owner_name:  newVendorName,
        assigned_to: newVendorId,
      })
      .select('id')
      .single()
    if (error) console.error('[cascade] insert deal:', error.message, error.details)
    else console.log('[cascade] deal creado:', newDeal?.id, 'stage:', targetStageId)
  }

  // Inbox: mensaje visible al vendedor via filtro from_name = nombre contacto asignado
  const { error: inboxErr } = await supabase
    .from('inbox_messages')
    .insert({
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
  if (inboxErr) console.error('[cascade] insert inbox:', inboxErr.message)
}
