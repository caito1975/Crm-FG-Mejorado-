export async function cascadeLeadAssignment(
  _supabase: unknown,
  userId: string,
  contactId: string,
  contactName: string,
  contactCompany: string | null,
  newVendorId: string,
  newVendorName: string,
  prevVendorId: string | null,
) {
  if (!newVendorId || newVendorId === prevVendorId) return

  try {
    const res = await fetch('/api/assign-lead', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId, contactId, contactName, contactCompany,
        newVendorId, newVendorName, prevVendorId,
      }),
    })
    const data = await res.json()
    console.log('[assignLead] response:', data)
  } catch (err) {
    console.error('[assignLead] fetch error:', err)
  }
}
