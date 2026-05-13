'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Contact, ContactStatus, Rubro } from '@/lib/types'
import { RUBROS } from '@/lib/types'
import Icon from '@/components/ui/Icon'

type MemberOption = { team_member_id: string; member_user_id: string; name: string; role: string }

interface Props {
  contact: Contact | null
  onSave: (data: Partial<Contact>) => void
  onClose: () => void
  isOwner?: boolean
  ownerId?: string
  ownerName?: string
}

export default function ContactModal({ contact, onSave, onClose, isOwner = true, ownerId, ownerName }: Props) {
  const supabase = createClient()
  const [teamMembers, setTeamMembers] = useState<MemberOption[]>([])

  const [form, setForm] = useState({
    name:        contact?.name        || '',
    company:     contact?.company     || '',
    role:        contact?.role        || '',
    email:       contact?.email       || '',
    phone:       contact?.phone       || '',
    city:        contact?.city        || '',
    status:      contact?.status      || 'lead' as ContactStatus,
    rubro:       contact?.rubro       || '' as Rubro | '',
    value:       contact?.value       || 0,
    tags:        contact?.tags?.join(', ') || '',
    owner_name:  contact?.owner_name  || '',
    assigned_to: contact?.assigned_to || '' as string | '',
    website:     contact?.website     || '',
  })

  useEffect(() => {
    supabase
      .from('team_members')
      .select('id, name, role, member_user_id')
      .eq('status', 'activo')
      .not('member_user_id', 'is', null)
      .order('name')
      .then(({ data }) => {
        if (data) setTeamMembers(data.map(m => ({
          team_member_id: m.id,
          member_user_id: m.member_user_id,
          name: m.name,
          role: m.role,
        })))
      })
  }, [])

  function handleMemberChange(memberUserId: string) {
    const member = teamMembers.find(m => m.member_user_id === memberUserId)
    setForm(f => ({
      ...f,
      assigned_to: memberUserId,
      owner_name: member?.name || '',
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      ...form,
      rubro:       (form.rubro || null) as Rubro | null,
      value:       Number(form.value),
      tags:        form.tags.split(',').map(t => t.trim()).filter(Boolean),
      assigned_to: form.assigned_to || null,
      owner_name:  form.assigned_to ? form.owner_name : null,
      website:     form.website || null,
      last_touch:  new Date().toISOString(),
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{contact ? 'Editar contacto' : 'Nuevo contacto'}</h2>
          <button className="btn ghost icon" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Nombre *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Empresa</label>
                <input className="input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div className="field">
                <label>Rol / Cargo</label>
                <input className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="field">
                <label>Teléfono</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="field">
                <label>Ciudad</label>
                <input className="input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="field">
                <label>Estado</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContactStatus }))}>
                  <option value="lead">Lead</option>
                  <option value="contactar">Contactar</option>
                  <option value="enviado">Enviado</option>
                  <option value="no_enviado">No enviado</option>
                  <option value="interesado">Interesado</option>
                  <option value="oportunidad">Oportunidad</option>
                  <option value="cliente">Cliente</option>
                  <option value="archivado">Archivado</option>
                </select>
              </div>
              <div className="field">
                <label>Rubro</label>
                <select className="input" value={form.rubro} onChange={e => setForm(f => ({ ...f, rubro: e.target.value as Rubro | '' }))}>
                  <option value="">— Sin rubro —</option>
                  {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Valor estimado ($)</label>
                <input className="input" type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} />
              </div>
              {isOwner && (
                <div className="field">
                  <label>Asignado a</label>
                  <select
                    className="input"
                    value={form.assigned_to}
                    onChange={e => handleMemberChange(e.target.value)}
                  >
                    <option value="">— Sin asignar —</option>
                    {ownerId && ownerName && (
                      <option value={ownerId}>{ownerName} · Yo</option>
                    )}
                    {teamMembers.map(m => (
                      <option key={m.member_user_id} value={m.member_user_id}>
                        {m.name}{m.role ? ` · ${m.role}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="field">
              <label>Website</label>
              <input className="input" type="url" value={form.website} placeholder="https://empresa.com" onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
            </div>
            <div className="field">
              <label>Tags (separados por coma)</label>
              <input className="input" value={form.tags} placeholder="retainer, saas, referral" onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn primary">
              {contact ? 'Guardar cambios' : 'Crear contacto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
