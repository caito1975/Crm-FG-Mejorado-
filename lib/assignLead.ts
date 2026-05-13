import type { SupabaseClient } from '@supabase/supabase-js'

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

  // Deal: reasignar activo existente o crear uno nuevo
  const { data: activeDeals } = await supabase
    .from('deals')
    .select('id')
    .eq('contact_id', contactId)
    .neq('stage_id', 'ganado')
    .neq('stage_id', 'perdido')
    .limit(1)

  if (activeDeals && activeDeals.length > 0) {
    const { error } = await supabase
      .from('deals')
      .update({ assigned_to: newVendorId, owner_name: newVendorName })
      .eq('id', activeDeals[0].id)
    if (error) console.error('[cascade] update deal:', error.message)
    else console.log('[cascade] deal reasignado:', activeDeals[0].id)
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
