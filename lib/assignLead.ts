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
) {
  if (!newVendorId || newVendorId === prevVendorId) return

  // Pipeline: reasignar deal activo o crear uno nuevo en "contactar"
  const { data: existingDeals } = await supabase
    .from('deals')
    .select('id')
    .eq('contact_id', contactId)
    .neq('stage_id', 'ganado')
    .neq('stage_id', 'perdido')
    .limit(1)

  if (existingDeals && existingDeals.length > 0) {
    await supabase
      .from('deals')
      .update({ assigned_to: newVendorId, owner_name: newVendorName })
      .eq('id', existingDeals[0].id)
  } else {
    await supabase.from('deals').insert({
      user_id: userId,
      title: `Lead: ${contactName}`,
      contact_id: contactId,
      stage_id: 'contactar',
      amount: 0,
      probability: 20,
      owner_name: newVendorName,
      assigned_to: newVendorId,
    })
  }

  // Inbox: mensaje visible al vendedor (el inbox filtra por from_name = nombre de contactos asignados)
  await supabase.from('inbox_messages').insert({
    user_id: userId,
    from_name: contactName,
    subject: `Lead asignado: ${contactName}`,
    preview: `Asignado a ${newVendorName}${contactCompany ? ` · ${contactCompany}` : ''}`,
    body: `Nuevo lead asignado a ${newVendorName}${contactCompany ? ` · ${contactCompany}` : ''}`,
    sent_label: 'Ahora',
    unread: true,
    starred: false,
    labels: [],
  })
}
