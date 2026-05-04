'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Contact, ContactStatus } from '@/lib/types'
import { useCurrency } from '@/lib/useCurrency'
import Icon from '@/components/ui/Icon'
import Avatar from '@/components/ui/Avatar'
import { StatusPill, TagPill } from '@/components/ui/Pill'
import ContactModal from './ContactModal'

const STATUS_FILTERS: { label: string; value: ContactStatus | 'all' }[] = [
  { label: 'Todos',        value: 'all' },
  { label: 'Leads',        value: 'lead' },
  { label: 'Enviados',     value: 'enviado' },
  { label: 'No enviados',  value: 'no_enviado' },
  { label: 'Interesados',  value: 'interesado' },
  { label: 'Enviar Mail',  value: 'enviar_mail' },
  { label: 'Oportunidades', value: 'oportunidad' },
  { label: 'Clientes',     value: 'cliente' },
  { label: 'Archivados',   value: 'archivado' },
]

interface Props {
  userId: string
  initialContacts: Contact[]
  isOwner?: boolean
  vendorId?: string
}

export default function ContactsTable({ userId, initialContacts, isOwner = true, vendorId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { formatAmount } = useCurrency()
  const [contacts, setContacts]     = useState(initialContacts)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all')
  const [showModal, setShowModal]   = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)

  const filtered = contacts.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    const matchSearch = !search || [c.name, c.company, c.email, c.city].some(
      f => f?.toLowerCase().includes(search.toLowerCase())
    )
    return matchStatus && matchSearch
  })

  async function handleSave(data: Partial<Contact>) {
    if (editContact) {
      const { data: updated } = await supabase
        .from('contacts').update(data).eq('id', editContact.id).select().single()
      if (updated) {
        setContacts(cs => cs.map(c => c.id === editContact.id ? updated as Contact : c))
        const c = updated as Contact
        // Registrar cambio de estado
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
        // Registrar reasignación de vendedor
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
      }
    } else {
      const autoAssign = !isOwner && vendorId ? { assigned_to: vendorId } : {}
      const { data: created } = await supabase
        .from('contacts').insert({ ...data, ...autoAssign, user_id: userId }).select().single()
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
            <p>{contacts.length} contactos · {contacts.filter(c => c.status === 'cliente').length} clientes</p>
          </div>
          <div className="page-actions">
            {/* Search */}
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
            <button
              className="btn primary"
              onClick={() => { setEditContact(null); setShowModal(true) }}
            >
              <Icon name="plus" size={13} /> Nuevo contacto
            </button>
          </div>
        </div>

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
                <th>Contacto</th>
                <th>Empresa</th>
                <th>Website</th>
                <th>Rubro</th>
                <th>Estado</th>
                <th>Ciudad</th>
                <th>Último contacto</th>
                <th>Valor</th>
                <th>Tags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  style={{ cursor: 'default' }}
                  onClick={() => router.push(`/contacts/${c.id}`)}
                >
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
                      ? <a href={c.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 12 }}>
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
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {c.tags.slice(0, 2).map(t => <TagPill key={t} tag={t} />)}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn ghost sm icon"
                        onClick={() => { setEditContact(c); setShowModal(true) }}
                      >
                        <Icon name="edit" size={13} />
                      </button>
                      <button
                        className="btn ghost sm icon"
                        onClick={() => handleDelete(c.id)}
                        style={{ color: 'var(--danger)' }}
                      >
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

      {showModal && (
        <ContactModal
          contact={editContact}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditContact(null) }}
          isOwner={isOwner}
        />
      )}
    </>
  )
}
