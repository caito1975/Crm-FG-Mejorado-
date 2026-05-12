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

  // ── Deduplicación por teléfono o email ──────────────────────────────────────
  let existing: { id: string; assigned_to: string | null; name: string } | null = null

  if (phone) {
    const { data } = await admin
      .from('contacts')
      .select('id, assigned_to, name')
      .eq('user_id', workspaceOwnerId)
      .eq('phone', phone)
      .maybeSingle()
    existing = data
  }

  if (!existing && email) {
    const { data } = await admin
      .from('contacts')
      .select('id, assigned_to, name')
      .eq('user_id', workspaceOwnerId)
      .eq('email', email)
      .maybeSingle()
    existing = data
  }

  // Si ya existe → actualizar last_touch y devolver el existente sin duplicar
  if (existing) {
    await admin
      .from('contacts')
      .update({ last_touch: new Date().toISOString() })
      .eq('id', existing.id)

    return NextResponse.json({
      ok:          true,
      contact_id:  existing.id,
      assigned_to: existing.assigned_to,
      vendor_name: ownerName,
      duplicate:   true,
      message:     `Contacto existente: ${existing.name}`,
    })
  }

  // ── Crear contacto nuevo ────────────────────────────────────────────────────
  const { data: contact, error } = await admin
    .from('contacts')
    .insert({
      user_id:     workspaceOwnerId,
      name,
      phone:       phone ?? null,
      email:       email ?? null,
      company:     company ?? null,
      city:        city ?? null,
      rubro:       rubro ?? null,
      status:      'lead',
      tags,
      value:       0,
      assigned_to: assignedTo,
      owner_name:  ownerName,
      last_touch:  new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('inbound lead error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log en historial solo para contactos nuevos
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
    ok:          true,
    contact_id:  contact.id,
    assigned_to: assignedTo,
    vendor_name: ownerName,
    duplicate:   false,
  })
}
