import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Shared secret set in env LEADS_WEBHOOK_SECRET
const WEBHOOK_SECRET = process.env.LEADS_WEBHOOK_SECRET

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

/**
 * POST /api/leads/inbound
 *
 * Called by n8n (or any automation) to create a lead and assign it
 * to the vendor with the fewest assigned contacts (round-robin equitativo).
 *
 * Headers:
 *   x-webhook-secret: <LEADS_WEBHOOK_SECRET>
 *
 * Body (JSON):
 *   name       string  required
 *   phone      string  optional
 *   email      string  optional
 *   company    string  optional
 *   city       string  optional
 *   rubro      string  optional
 *   source     string  optional  (saved as first tag)
 *   owner_uid  string  optional  override workspace owner UID
 */
export async function POST(req: NextRequest) {
  // Auth check
  const secret = req.headers.get('x-webhook-secret')
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { name, phone, email, company, city, rubro, source, owner_uid } = body

  if (!name) {
    return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Resolve workspace owner: use override or fall back to env var
  const workspaceOwnerId: string = owner_uid || process.env.CRM_OWNER_UID || ''
  if (!workspaceOwnerId) {
    return NextResponse.json({ error: 'CRM_OWNER_UID no configurado' }, { status: 500 })
  }

  // Pick the next vendor via round-robin (fewest assigned contacts)
  const { data: vendorRow } = await admin.rpc('next_round_robin_vendor', {
    owner_uid: workspaceOwnerId,
  })

  const assignedTo: string | null = vendorRow ?? null

  // Resolve vendor name for display
  let ownerName: string | null = null
  if (assignedTo) {
    const { data: member } = await admin
      .from('team_members')
      .select('name')
      .eq('owner_id', workspaceOwnerId)
      .eq('member_user_id', assignedTo)
      .maybeSingle()
    ownerName = member?.name ?? null
  }

  const tags = source ? [source] : []

  // Create contact
  const { data: contact, error } = await admin
    .from('contacts')
    .insert({
      user_id:    workspaceOwnerId,
      name,
      phone:      phone ?? null,
      email:      email ?? null,
      company:    company ?? null,
      city:       city ?? null,
      rubro:      rubro ?? null,
      status:     'lead',
      tags,
      value:      0,
      assigned_to: assignedTo,
      owner_name: ownerName,
      last_touch: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('inbound lead error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log in historial
  await admin.from('historial_leads').insert({
    user_id:        workspaceOwnerId,
    fecha:          new Date().toISOString(),
    nombre:         name,
    numero:         phone ?? null,
    tipo:           'ASIGNACION',
    mensaje:        `Lead asignado a ${ownerName ?? 'sin vendedor'} vía webhook`,
    etapa_anterior: 'NO_ENVIADO',
    etapa_nueva:    'LEAD',
    vendedor:       ownerName,
    contact_id:     contact.id,
  })

  return NextResponse.json({
    ok: true,
    contact_id:  contact.id,
    assigned_to: assignedTo,
    vendor_name: ownerName,
  })
}
