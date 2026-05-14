'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Deal, PipelineStage, Contact } from '@/lib/types'
import { useCurrency } from '@/lib/useCurrency'
import Icon from '@/components/ui/Icon'

type MemberOption = { id: string; name: string; role: string }

interface Props {
  deal: Deal | null
  defaultStageId: string
  stages: PipelineStage[]
  contacts: Pick<Contact, 'id' | 'name' | 'company'>[]
  onSave: (data: Partial<Deal>) => void
  onClose: () => void
}

export default function DealModal({ deal, defaultStageId, stages, contacts, onSave, onClose }: Props) {
  const supabase = createClient()
  const { currency } = useCurrency()
  const [teamMembers, setTeamMembers] = useState<MemberOption[]>([])

  useEffect(() => {
    supabase
      .from('team_members')
      .select('id, name, role')
      .neq('status', 'inactivo')
      .order('name')
      .then(({ data }) => { if (data) setTeamMembers(data as MemberOption[]) })
  }, [])

  const [form, setForm] = useState({
    title:       deal?.title       || '',
    contact_id:  deal?.contact_id  || '',
    stage_id:    deal?.stage_id    || defaultStageId,
    amount:      deal?.amount      || 0,
    probability: deal?.probability || 20,
    close_date:  deal?.close_date  || '',
    owner_name:  deal?.owner_name  || '',
    notes:       deal?.notes       || '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      ...form,
      amount: Number(form.amount),
      probability: Number(form.probability),
      contact_id: form.contact_id || null,
      close_date: form.close_date || null,
      notes: form.notes || null,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{deal ? 'Editar deal' : 'Nuevo deal'}</h2>
          <button className="btn ghost icon" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label>Nombre del deal *</label>
              <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Ej: Rebrand Mercado Norte 2026" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Contacto</label>
                <select className="input" value={form.contact_id} onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))}>
                  <option value="">Sin contacto</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Etapa</label>
                <select className="input" value={form.stage_id} onChange={e => setForm(f => ({ ...f, stage_id: e.target.value }))}>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Monto ({currency})</label>
                <input className="input" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} />
              </div>
              <div className="field">
                <label>Probabilidad (%)</label>
                <input className="input" type="number" min={0} max={100} value={form.probability} onChange={e => setForm(f => ({ ...f, probability: Number(e.target.value) }))} />
              </div>
              <div className="field">
                <label>Fecha de cierre</label>
                <input className="input" type="date" value={form.close_date} onChange={e => setForm(f => ({ ...f, close_date: e.target.value }))} />
              </div>
              <div className="field">
                <label>Owner / Vendedor</label>
                <select
                  className="input"
                  value={form.owner_name}
                  onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
                >
                  <option value="">— Sin asignar —</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.name}>
                      {m.name}{m.role ? ` · ${m.role}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label>Notas</label>
              <textarea
                className="input"
                rows={4}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notas internas sobre este deal..."
                style={{ resize: 'vertical', minHeight: 80 }}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn primary">
              {deal ? 'Guardar cambios' : 'Crear deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
