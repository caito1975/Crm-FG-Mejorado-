'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Contact, ContactStatus } from '@/lib/types'
import { useCurrency } from '@/lib/useCurrency'
import Icon from '@/components/ui/Icon'
import Avatar from '@/components/ui/Avatar'
import { StatusPill } from '@/components/ui/Pill'
import ContactModal from './ContactModal'
import { cascadeLeadAssignment } from '@/lib/assignLead'

const STATUS_FILTERS: { label: string; value: ContactStatus | 'all' }[] = [
  { label: 'Todos',         value: 'all' },
  { label: 'Leads',         value: 'lead' },
  { label: 'Contactar',     value: 'contactar' },
  { label: 'Contactado',    value: 'contactado' },
  { label: 'Enviados',      value: 'enviado' },
  { label: 'No enviados',   value: 'no_enviado' },
  { label: 'Interesados',   value: 'interesado' },
  { label: 'Oportunidades', value: 'oportunidad' },
  { label: 'Clientes',      value: 'cliente' },
  { label: 'Archivados',    value: 'archivado' },
]

type VendorOption = { member_user_id: string; name: string; role: string }

interface Props {
  userId: string
  ownerName?: string
  initialContacts: Contact[]
  isOwner?: boolean
  vendorId?: string
  activityFilter?: 'stale'
  statusFilter?: string
}

export default function ContactsTable({ userId, ownerName, initialContacts, isOwner = true, vendorId, activityFilter, statusFilter: statusFilterProp }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { formatAmount } = useCurrency()

  const [contacts, setContacts]         = useState(initialContacts)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>(
    (statusFilterProp as ContactStatus) || 'all'
  )
  const [showModal, setShowModal]       = useState(false)
  const [editContact, setEditContact]   = useState<Contact | null>(null)

  // Bulk assignment state
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [vendors, setVendors]           = useState<VendorOption[]>([])
  const [bulkVendorId, setBulkVendorId] = useState('')
  const [assigning, setAssigning]       = useState(false)

  // Load vendors for bulk assignment (owner only)
  useEffect(() => {
    if (!isOwner) return
    supabase
      .from('team_members')
      .select('member_user_id, name, role')
      .eq('owner_id', userId)
      .eq('status', 'activo')
      .not('member_user_id', 'is', null)
      .order('name')
      .then(({ data }) => {
        if (data) setVendors(data as VendorOption[])
      })
  }, [isOwner, userId])

  // Polling + realtime to reflect status changes made from pipeline
  useEffect(() => {
    const fetchContacts = () =>
      supabase.from('contacts').select('*').eq('user_id', userId).order('name')
        .then(({ data }) => data && setContacts(data as Contact[]))

    const realtimeFilter = vendorId
      ? `assigned_to=eq.${vendorId}`
      : `user_id=eq.${userId}`

    const ch = supabase.channel('contacts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: realtimeFilter }, fetchContacts)
      .subscribe()

    const timer = setInterval(fetchContacts, 15_000)
    return () => { supabase.removeChannel(ch); clearInterval(timer) }
  }, [userId, vendorId])

  const stale14Cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const filtered = contacts.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    const matchSearch = !search || [c.name, c.company, c.email, c.city].some(
      f => f?.toLowerCase().includes(search.toLowerCase())
    )
    const matchActivity = activityFilter !== 'stale' || (
      !c.last_touch || new Date(c.last_touch) < stale14Cutoff
    )
    return matchStatus && matchSearch && matchActivity
  })

  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id))

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(c => next.delete(c.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(c => next.add(c.id))
        return next
      })
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleBulkAssign() {
    if (!bulkVendorId || selected.size === 0) return
    const vendor = vendors.find(v => v.member_user_id === bulkVendorId)
    if (!vendor) return

    setAssigning(true)
    const ids = Array.from(selected)

    // Capturar assigned_to y company previos antes de actualizar
    const { data: prevData } = await supabase
      .from('contacts')
      .select('id, assigned_to, company')
      .in('id', ids)
    const prevMap = Object.fromEntries(
      (prevData ?? []).map(c => [c.id, { assigned_to: c.assigned_to as string | null, company: c.company as string | null }])
    )

    const { data: updated } = await supabase
      .from('contacts')
      .update({ assigned_to: bulkVendorId, owner_name: vendor.name })
      .in('id', ids)
      .select('id, name, phone, status')

    if (updated) {
      // Update local state
      setContacts(cs => cs.map(c =>
        selected.has(c.id) ? { ...c, assigned_to: bulkVendorId, owner_name: vendor.name } : c
      ))

      // Historial batch insert
      const historial = (updated as { id: string; name: string; phone: string | null; status: string }[])
        .map(c => ({
          user_id:        userId,
          fecha:          new Date().toISOString(),
          nombre:         c.name,
          numero:         c.phone ?? null,
          tipo:           'ASIGNACION' as const,
          mensaje:        `Asignación masiva a ${vendor.name}`,
          etapa_anterior: c.status,
          etapa_nueva:    c.status,
          vendedor:       vendor.name,
          contact_id:     c.id,
        }))
      await supabase.from('historial_leads').insert(historial)

      // Cascade: deal en pipeline + inbox para cada contacto asignado
      await Promise.all(
        (updated as { id: string; name: string }[]).map(c =>
          cascadeLeadAssignment(
            supabase, userId, c.id, c.name, prevMap[c.id]?.company ?? null,
            bulkVendorId, vendor.name, prevMap[c.id]?.assigned_to ?? null,
          )
        )
      )
    }

    setSelected(new Set())
    setBulkVendorId('')
    setAssigning(false)
  }

  async function handleSave(data: Partial<Contact>) {
    if (editContact) {
      const { data: updated, error } = await supabase
        .from('contacts').update(data).eq('id', editContact.id).select().single()
      if (error) {
        alert(`Error al guardar: ${error.message}`)
        return
      }
      if (updated) {
        setContacts(cs => cs.map(c => c.id === editContact.id ? updated as Contact : c))
        const c = updated as Contact
        if (data.status && data.status !== editContact.status) {
          await supabase.from('historial_leads').insert({
            user_id:        userId,
            fecha:          new Date().toISOString(),
            nombre:         c.name,
            numero:         c.phone ?? null,
            tipo:           'CAMBIO_ESTADO',
            mensaje:        `Estado cambiado a ${data.status}`,
            etapa_anterior: editContact.status,
            etapa_nueva:    data.status,
            vendedor:       c.owner_name ?? null,
            contact_id:     c.id,
          })
        }
        if (data.owner_name && data.owner_name !== editContact.owner_name) {
          await supabase.from('historial_leads').insert({
            user_id:        userId,
            fecha:          new Date().toISOString(),
            nombre:         c.name,
            numero:         c.phone ?? null,
            tipo:           'ASIGNACION',
            mensaje:        `Asignado a ${data.owner_name}`,
            etapa_anterior: c.status,
            etapa_nueva:    c.status,
            vendedor:       data.owner_name,
            contact_id:     c.id,
          })
        }
        if (data.assigned_to && data.assigned_to !== editContact.assigned_to) {
          console.log('[cascade] disparando desde ContactsTable handleSave', { contactId: editContact.id, newVendorId: data.assigned_to })
          await cascadeLeadAssignment(
            supabase, userId, editContact.id, c.name, c.company,
            data.assigned_to, data.owner_name ?? '', editContact.assigned_to,
            data.status ?? editContact.status,
          )
        }
      }
    } else {
      // Chequeo de duplicados antes de insertar
      if (data.phone || data.email) {
        let dupQuery = supabase.from('contacts').select('id, name').eq('user_id', userId)
        if (data.phone) {
          const { data: byPhone } = await dupQuery.eq('phone', data.phone).maybeSingle()
          if (byPhone) {
            alert(`Ya existe un contacto con ese teléfono: "${(byPhone as any).name}". Editalo desde la tabla en lugar de crear uno nuevo.`)
            return
          }
        }
        if (data.email) {
          const { data: byEmail } = await supabase.from('contacts').select('id, name').eq('user_id', userId).eq('email', data.email).maybeSingle()
          if (byEmail) {
            alert(`Ya existe un contacto con ese email: "${(byEmail as any).name}". Editalo desde la tabla en lugar de crear uno nuevo.`)
            return
          }
        }
      }

      const autoAssign = !isOwner && vendorId ? { assigned_to: vendorId } : {}
      const { data: created, error } = await supabase
        .from('contacts').insert({ ...data, ...autoAssign, user_id: userId }).select().single()
      if (error) {
        alert(`Error al crear contacto: ${error.message}`)
        return
      }
      if (created) {
        setContacts(cs => [created as Contact, ...cs])
        const c = created as Contact
        await supabase.from('historial_leads').insert({
          user_id:        userId,
          fecha:          new Date().toISOString(),
          nombre:         c.name,
          numero:         c.phone ?? null,
          tipo:           'ASIGNACION',
          mensaje:        `Asignado a ${c.owner_name ?? 'sin vendedor'}`,
          etapa_anterior: 'NO_ENVIADO',
          etapa_nueva:    c.status?.toUpperCase() ?? 'LEAD',
          vendedor:       c.owner_name ?? null,
          contact_id:     c.id,
        })
      }
    }
    setShowModal(false)
    setEditContact(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este contacto?')) return
    await supabase.from('contacts').delete().eq('id', id)
    setContacts(cs => cs.filter(c => c.id !== id))
  }

  return (
    <>
      <div className="page">
        <div className="page-head">
          <div>
            <h1>Contactos</h1>
            <p>
              {contacts.length} contactos · {contacts.filter(c => c.status === 'cliente').length} clientes
              {isOwner && contacts.filter(c => !c.assigned_to).length > 0 && (
                <span style={{ color: 'var(--warning)', marginLeft: 8 }}>
                  · {contacts.filter(c => !c.assigned_to).length} sin asignar
                </span>
              )}
            </p>
          </div>
          <div className="page-actions">
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }}>
                <Icon name="search" size={13} />
              </span>
              <input
                className="input"
                style={{ paddingLeft: 28, width: 200 }}
                placeholder="Buscar contacto…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn primary" onClick={() => { setEditContact(null); setShowModal(true) }}>
              <Icon name="plus" size={13} /> Nuevo contacto
            </button>
          </div>
        </div>

        {/* Stale activity banner */}
        {activityFilter === 'stale' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
            padding: '8px 12px', borderRadius: 6,
            background: 'var(--warning-soft, rgba(245,158,11,.12))',
            border: '1px solid rgba(245,158,11,.3)',
            fontSize: 12, color: 'var(--warning)',
          }}>
            <Icon name="flag" size={13} />
            <span>Mostrando contactos sin actividad en los últimos 14 días · {filtered.length} contacto{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              className={`tab ${statusFilter === f.value ? 'active' : ''}`}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
              <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-subtle)' }}>
                {f.value === 'all' ? contacts.length : contacts.filter(c => c.status === f.value).length}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                {isOwner && (
                  <th style={{ width: 36, paddingRight: 0 }}>
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer' }}
                      title={allFilteredSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    />
                  </th>
                )}
                <th>Contacto</th>
                <th>Empresa</th>
                <th>Website</th>
                <th>Rubro</th>
                <th>Estado</th>
                <th>Ciudad</th>
                <th>Último contacto</th>
                <th>Valor</th>
                <th>Asignado a</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  style={{
                    cursor: 'default',
                    background: selected.has(c.id) ? 'var(--bg-hover)' : undefined,
                  }}
                  onClick={() => router.push(`/contacts/${c.id}`)}
                >
                  {isOwner && (
                    <td style={{ paddingRight: 0 }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  <td>
                    <div className="row-pic">
                      <Avatar name={c.name} tone="accent" />
                      <div>
                        <div className="cell-strong">{c.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="cell-muted">{c.company || '—'}</td>
                  <td className="cell-muted">
                    {c.website
                      ? <a href={c.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 12 }} onClick={e => e.stopPropagation()}>
                          {c.website.replace(/^https?:\/\//, '')}
                        </a>
                      : '—'}
                  </td>
                  <td className="cell-muted">{c.rubro || '—'}</td>
                  <td><StatusPill status={c.status} /></td>
                  <td className="cell-muted">{c.city || '—'}</td>
                  <td className="cell-muted">
                    {c.last_touch ? new Date(c.last_touch).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td className="cell-mono">
                    {c.value ? formatAmount(c.value) : '—'}
                  </td>
                  <td className="cell-muted">
                    {c.owner_name
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                          {c.owner_name}
                        </span>
                      : <span style={{ color: 'var(--warning)', fontSize: 11.5 }}>Sin asignar</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button className="btn ghost sm icon" onClick={() => { setEditContact(c); setShowModal(true) }}>
                        <Icon name="edit" size={13} />
                      </button>
                      <button className="btn ghost sm icon" onClick={() => handleDelete(c.id)} style={{ color: 'var(--danger)' }}>
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty">
              <h4>Sin contactos</h4>
              <p>{search ? 'Ningún contacto coincide con tu búsqueda.' : 'Agregá tu primer contacto.'}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk assignment bar ─────────────────────────────────────── */}
      {isOwner && selected.size > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '10px 16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          minWidth: 420,
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--accent)', color: '#fff',
              borderRadius: 6, padding: '1px 7px', fontSize: 12, marginRight: 7,
            }}>{selected.size}</span>
            {selected.size === 1 ? 'contacto seleccionado' : 'contactos seleccionados'}
          </span>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

          <Icon name="team" size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <select
            className="input"
            style={{ flex: 1, minWidth: 160, height: 32, padding: '0 8px', fontSize: 13 }}
            value={bulkVendorId}
            onChange={e => setBulkVendorId(e.target.value)}
          >
            <option value="">Asignar a…</option>
            {vendors.map(v => (
              <option key={v.member_user_id} value={v.member_user_id}>
                {v.name}{v.role ? ` · ${v.role}` : ''}
              </option>
            ))}
          </select>

          <button
            className="btn primary"
            style={{ height: 32, padding: '0 14px', fontSize: 13, whiteSpace: 'nowrap' }}
            disabled={!bulkVendorId || assigning}
            onClick={handleBulkAssign}
          >
            {assigning ? 'Asignando…' : 'Asignar'}
          </button>

          <button
            className="btn"
            style={{ height: 32, padding: '0 10px', fontSize: 13 }}
            onClick={() => { setSelected(new Set()); setBulkVendorId('') }}
          >
            Cancelar
          </button>
        </div>
      )}

      {showModal && (
        <ContactModal
          contact={editContact}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditContact(null) }}
          isOwner={isOwner}
          ownerId={userId}
          ownerName={ownerName}
        />
      )}
    </>
  )
}
