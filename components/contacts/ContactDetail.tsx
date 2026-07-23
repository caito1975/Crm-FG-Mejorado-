'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Contact, Deal, Task, Activity, ActivityKind } from '@/lib/types'
import { formatCurrency } from '@/lib/types'
import Icon from '@/components/ui/Icon'
import Avatar from '@/components/ui/Avatar'
import { StatusPill, PriorityPill, TagPill } from '@/components/ui/Pill'
import ContactModal from './ContactModal'
import { cascadeLeadAssignment, syncDealStageFromStatus } from '@/lib/assignLead'

const ACTIVITY_ICONS: Record<ActivityKind, string> = {
  email_in:     'mail',
  email_out:    'send',
  call_out:     'phone',
  meeting:      'meet',
  note:         'edit',
  invoice:      'card',
  stage_change: 'pipeline',
}

const STAGE_LABELS: Record<string, string> = {
  enviado: 'Enviado', reu_inicial: 'Reu. Inicial',
  seg_reu: 'Seg. Reunión', doc_enviada: 'Doc. Enviada', prop_enviada: 'Prop. Enviada',
  ped_fc: 'Ped. de FC', doc_firmada: 'Doc. Firmada', ganado: 'Ganado-Consumo', perdido: 'Perdido',
}

type Tab = 'actividad' | 'deals' | 'tareas' | 'nota'

// Convert the HTML clipboard flavor (Word/Outlook/Gmail) to plain text keeping
// bullets and line breaks — the plain-text flavor drops Word list bullets entirely.
function htmlClipboardToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? '').replace(/ /g, ' ').replace(/[\n\r\t]+/g, ' ')
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    if (['style', 'script', 'meta', 'title', 'head'].includes(tag)) return ''
    if (tag === 'br') return '\n'

    const inner = Array.from(el.childNodes).map(walk).join('')

    if (tag === 'li') return '• ' + inner.trim() + '\n'
    if (tag === 'ul' || tag === 'ol') return inner + '\n'
    if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'table'].includes(tag)) {
      const t = inner.replace(/^[ ]+|[ ]+$/g, '')
      if (!t.trim()) return '\n'
      // Word marks list paragraphs with MsoListParagraph and puts ·/§/o as fake bullet
      const cls = el.getAttribute('class') ?? ''
      if (/MsoListParagraph/i.test(cls)) {
        return '• ' + t.replace(/^[·•§o▪]\s*/, '').trim() + '\n'
      }
      return t + '\n\n'
    }
    return inner
  }

  return walk(doc.body)
    .replace(/[ ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface Props {
  userId: string
  ownerName?: string
  contact: Contact
  initialDeals: Deal[]
  initialTasks: Task[]
  initialActivities: Activity[]
  isOwner?: boolean
}

export default function ContactDetail({ userId, ownerName, contact: initialContact, initialDeals, initialTasks, initialActivities, isOwner = true }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [contact, setContact]     = useState(initialContact)
  const [deals]                   = useState(initialDeals)
  const [tasks, setTasks]         = useState(initialTasks)
  const [activities, setActivities] = useState(initialActivities)
  const [tab, setTab]             = useState<Tab>('actividad')
  const [showEdit, setShowEdit]   = useState(false)
  const [noteText, setNoteText]   = useState('')
  const [taskForm, setTaskForm]   = useState({ title: '', priority: 'media', due_label: '' })
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showCompose, setShowCompose]   = useState(false)
  const [showPhoneMenu, setShowPhoneMenu] = useState(false)
  const [showWaModal, setShowWaModal]   = useState(false)
  const [waMessage, setWaMessage]       = useState('')
  const [compose, setCompose]           = useState({ subject: '', body: '' })
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendError, setSendError]       = useState('')

  async function handleSaveContact(data: Partial<Contact>) {
    const { data: updated } = await supabase.from('contacts').update(data).eq('id', contact.id).select().single()
    if (updated) {
      setContact(updated as Contact)
      const c = updated as Contact
      if (data.status && data.status !== contact.status) {
        await supabase.from('historial_leads').insert({
          user_id:        userId,
          fecha:          new Date().toISOString(),
          nombre:         c.name,
          numero:         c.phone ?? null,
          tipo:           'CAMBIO_ESTADO',
          mensaje:        `Estado cambiado a ${data.status}`,
          etapa_anterior: contact.status,
          etapa_nueva:    data.status,
          vendedor:       c.owner_name ?? null,
          contact_id:     c.id,
        })
        await syncDealStageFromStatus(supabase, c.id, data.status)
      }
      if (data.owner_name && data.owner_name !== contact.owner_name) {
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
      if (data.assigned_to && data.assigned_to !== contact.assigned_to) {
        console.log('[cascade] disparando desde ContactDetail', { contactId: contact.id, newVendorId: data.assigned_to, prevVendorId: contact.assigned_to })
        await cascadeLeadAssignment(
          supabase, userId, contact.id, c.name, c.company,
          data.assigned_to, data.owner_name ?? '', contact.assigned_to,
          data.status ?? contact.status,
        )
      }
    }
    setShowEdit(false)
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteText.trim()) return
    const now = new Date().toISOString()
    const { data: act } = await supabase.from('activities').insert({
      user_id: userId, kind: 'note', who: 'tú', body: noteText, contact_id: contact.id,
    }).select().single()
    if (act) setActivities(as => [act as Activity, ...as])
    await supabase.from('historial_leads').insert({
      user_id:        userId,
      fecha:          now,
      nombre:         contact.name,
      numero:         contact.phone ?? null,
      tipo:           'NOTA',
      mensaje:        noteText.slice(0, 300),
      etapa_anterior: contact.status,
      etapa_nueva:    contact.status,
      vendedor:       contact.owner_name ?? null,
      contact_id:     contact.id,
    })
    setNoteText('')
  }

  async function registerWhatsApp(msg: string) {
    const now = new Date().toISOString()
    const { data: act } = await supabase.from('activities').insert({
      user_id: userId, kind: 'whatsapp_out', who: 'tú', body: msg || `WhatsApp a ${contact.name}`, contact_id: contact.id,
    }).select().single()
    if (act) setActivities(as => [act as Activity, ...as])
    await supabase.from('historial_leads').insert({
      user_id:        userId,
      fecha:          now,
      nombre:         contact.name,
      numero:         contact.phone ?? null,
      tipo:           'WHATSAPP',
      mensaje:        msg || 'WhatsApp enviado',
      etapa_anterior: contact.status,
      etapa_nueva:    contact.status,
      vendedor:       contact.owner_name ?? null,
      contact_id:     contact.id,
    })
  }

  async function handleWaSend() {
    const msg = waMessage.trim()
    const phone = contact.phone!.replace(/\D/g, '')
    const url = msg
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/${phone}`
    setShowWaModal(false)
    setShowPhoneMenu(false)
    setWaMessage('')
    window.open(url, '_blank')
    await registerWhatsApp(msg)
  }

  async function registerCall() {
    const now = new Date().toISOString()
    const { data: act } = await supabase.from('activities').insert({
      user_id: userId, kind: 'call_out', who: 'tú', body: `Llamada a ${contact.name}`, contact_id: contact.id,
    }).select().single()
    if (act) setActivities(as => [act as Activity, ...as])
    await supabase.from('historial_leads').insert({
      user_id:        userId,
      fecha:          now,
      nombre:         contact.name,
      numero:         contact.phone ?? null,
      tipo:           'LLAMADA',
      mensaje:        `Llamada registrada`,
      etapa_anterior: contact.status,
      etapa_nueva:    contact.status,
      vendedor:       contact.owner_name ?? null,
      contact_id:     contact.id,
    })
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    const { data: task } = await supabase.from('tasks').insert({
      user_id: userId, contact_id: contact.id,
      title: taskForm.title, priority: taskForm.priority, due_label: taskForm.due_label,
    }).select().single()
    if (task) setTasks(ts => [task as Task, ...ts])
    setTaskForm({ title: '', priority: 'media', due_label: '' })
    setShowTaskForm(false)
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!contact.email) return
    setSendingEmail(true)
    setSendError('')
    const res = await fetch('/api/integrations/gmail/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ to: contact.email, subject: compose.subject, body: compose.body, contact_id: contact.id }),
    })
    const data = await res.json()
    setSendingEmail(false)
    if (!res.ok) {
      setSendError(data.error ?? 'Error al enviar')
      return
    }
    const sentAt = new Date().toISOString()
    const act: Activity = {
      id: crypto.randomUUID(), created_at: sentAt,
      user_id: userId, kind: 'email_out', who: 'tú',
      body: compose.subject, contact_id: contact.id, deal_id: null,
    }
    setActivities(as => [act, ...as])
    await supabase.from('historial_leads').insert({
      user_id:        userId,
      fecha:          sentAt,
      nombre:         contact.name,
      numero:         contact.phone ?? null,
      tipo:           'EMAIL',
      mensaje:        compose.subject,
      etapa_anterior: contact.status,
      etapa_nueva:    contact.status,
      vendedor:       contact.owner_name ?? null,
      contact_id:     contact.id,
    })
    setCompose({ subject: '', body: '' })
    setShowCompose(false)
  }

  async function toggleTask(id: string, done: boolean) {
    await supabase.from('tasks').update({ done }).eq('id', id)
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done } : t))
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', height: '100%' }}>
      {/* Left panel — contact info */}
      <div style={{ borderRight: '1px solid var(--border)', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <Avatar name={contact.name} size="xl" tone="accent" />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{contact.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{contact.role}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{contact.company}</div>
          </div>
          <StatusPill status={contact.status} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary sm" onClick={() => setShowEdit(true)}>
              <Icon name="edit" size={12} /> Editar
            </button>
            <button className="btn sm" onClick={() => router.push('/contacts')}>
              <Icon name="chev_left" size={12} /> Volver
            </button>
          </div>
        </div>

        <div className="divider" />

        {/* Details */}
        {[
          { icon: 'mail',     label: 'Email',   val: contact.email,   action: contact.email ? () => setShowCompose(true) : undefined },
          { icon: 'building', label: 'Empresa', val: contact.company },
          { icon: 'pin',      label: 'Ciudad',  val: contact.city },
          { icon: 'dollar',   label: 'Valor',   val: contact.value ? formatCurrency(contact.value) : null },
        ].map(row => row.val ? (
          <div key={row.icon} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
            <span style={{ color: 'var(--text-subtle)' }}><Icon name={row.icon} size={14} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 1 }}>{row.label}</div>
              {'action' in row && row.action ? (
                <button
                  onClick={row.action}
                  style={{ color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, textAlign: 'left', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}
                >
                  {row.val}
                </button>
              ) : (
                <div style={{ color: 'var(--text)', textOverflow: 'ellipsis', overflow: 'hidden' }}>{row.val}</div>
              )}
            </div>
          </div>
        ) : null)}

        {/* Teléfono con acciones */}
        {contact.phone && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5 }}>
            <span style={{ color: 'var(--text-subtle)', marginTop: 14 }}><Icon name="phone" size={14} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 1 }}>Teléfono</div>
              <button
                onClick={() => setShowPhoneMenu(m => !m)}
                style={{ color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, textAlign: 'left' }}
              >
                {contact.phone}
              </button>
              {showPhoneMenu && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <a
                    href={`tel:${contact.phone}`}
                    onClick={async () => { setShowPhoneMenu(false); await registerCall() }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--text)', textDecoration: 'none', cursor: 'pointer' }}
                  >
                    <Icon name="phone" size={12} /> Llamar
                  </a>
                  <button
                    onClick={() => { setShowPhoneMenu(false); setShowWaModal(true) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--success)', cursor: 'pointer' }}
                  >
                    <Icon name="whatsapp" size={12} /> WhatsApp
                  </button>
                  <button
                    onClick={async () => { setShowPhoneMenu(false); await registerCall() }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--success-soft)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--success)', cursor: 'pointer' }}
                  >
                    <Icon name="check" size={12} /> Registrar llamada
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {contact.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {contact.tags.map(t => <TagPill key={t} tag={t} />)}
          </div>
        )}

        {/* Deals summary */}
        {deals.length > 0 && (
          <>
            <div className="divider" />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-subtle)', marginBottom: 10 }}>Deals</div>
              {deals.map(d => (
                <div key={d.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{d.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{STAGE_LABELS[d.stage_id] || d.stage_id}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>USD {(d.amount / 1000).toFixed(0)}k</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right panel — tabs */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="tabs" style={{ padding: '0 24px', flexShrink: 0 }}>
          {(['actividad', 'deals', 'tareas', 'nota'] as Tab[]).map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {/* Activity tab */}
          {tab === 'actividad' && (
            <div>
              <form onSubmit={addNote} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <input
                  className="input"
                  placeholder="Agregar nota rápida…"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn primary" disabled={!noteText.trim()}>
                  <Icon name="send" size={13} /> Guardar
                </button>
              </form>
              <div className="timeline">
                {activities.map(a => (
                  <div key={a.id} className="tl-item">
                    <div className="tl-ico">
                      <Icon name={ACTIVITY_ICONS[a.kind] || 'doc'} size={13} />
                    </div>
                    <div className="tl-content">
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>
                        {a.who || 'Sistema'}
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
                          {({ email_in: '→ email recibido', email_out: '→ email enviado', call_out: '→ llamada', meeting: '→ reunión', note: '→ nota', invoice: '→ factura', stage_change: '→ cambio de etapa' } as Record<string, string>)[a.kind]}
                        </span>
                      </div>
                      <div className="tl-body">{a.body}</div>
                      <div className="tl-meta">
                        {new Date(a.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <div className="empty"><p>Sin actividad registrada para este contacto.</p></div>
                )}
              </div>
            </div>
          )}

          {/* Deals tab */}
          {tab === 'deals' && (
            <div>
              {deals.map(d => (
                <div key={d.id} className="card" style={{ marginBottom: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{d.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        {STAGE_LABELS[d.stage_id] || d.stage_id} · {d.probability}% probabilidad
                        {d.close_date && ` · Cierre: ${new Date(d.close_date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}`}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600 }}>
                      {formatCurrency(d.amount)}
                    </div>
                  </div>
                </div>
              ))}
              {deals.length === 0 && <div className="empty"><p>Sin deals asociados.</p></div>}
            </div>
          )}

          {/* Tasks tab */}
          {tab === 'tareas' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                {!showTaskForm ? (
                  <button className="btn" onClick={() => setShowTaskForm(true)}>
                    <Icon name="plus" size={13} /> Nueva tarea
                  </button>
                ) : (
                  <form onSubmit={addTask} className="card" style={{ padding: 16, marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input className="input" placeholder="Descripción de la tarea" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} required style={{ flex: 1 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select className="input" style={{ flex: 1 }} value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                        <option value="alta">Prioridad Alta</option>
                        <option value="media">Prioridad Media</option>
                        <option value="baja">Prioridad Baja</option>
                      </select>
                      <input className="input" placeholder="Vence (ej: hoy, mañana)" value={taskForm.due_label} onChange={e => setTaskForm(f => ({ ...f, due_label: e.target.value }))} style={{ flex: 1 }} />
                      <button type="submit" className="btn primary">Crear</button>
                      <button type="button" className="btn" onClick={() => setShowTaskForm(false)}>Cancelar</button>
                    </div>
                  </form>
                )}
              </div>
              {tasks.map(t => (
                <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span className={`chk ${t.done ? 'on' : ''}`} onClick={() => toggleTask(t.id, !t.done)} />
                  <div style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--text-muted)' : 'var(--text)' }}>
                    {t.title}
                  </div>
                  <PriorityPill priority={t.priority} />
                  {t.due_label && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t.due_label}</span>}
                </div>
              ))}
              {tasks.length === 0 && !showTaskForm && <div className="empty"><p>Sin tareas para este contacto.</p></div>}
            </div>
          )}

          {/* Quick note tab */}
          {tab === 'nota' && (
            <div>
              <p style={{ color: 'var(--text-muted)', marginBottom: 12, fontSize: 13 }}>
                Añadí una nota o registro de interacción con {contact.name}.
              </p>
              <form onSubmit={addNote} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <textarea className="input" rows={4} placeholder="Escribí tu nota aquí…" value={noteText} onChange={e => setNoteText(e.target.value)} />
                <div>
                  <button type="submit" className="btn primary" disabled={!noteText.trim()}>
                    <Icon name="send" size={13} /> Guardar nota
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <ContactModal
          contact={contact}
          onSave={handleSaveContact}
          onClose={() => setShowEdit(false)}
          isOwner={isOwner}
          ownerId={userId}
          ownerName={ownerName}
        />
      )}

      {showWaModal && (
        <div className="modal-backdrop" onClick={() => { setShowWaModal(false); setWaMessage('') }}>
          <div className="modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="whatsapp" size={16} /> WhatsApp a {contact.name}
              </h3>
              <button className="btn ghost sm icon" onClick={() => { setShowWaModal(false); setWaMessage('') }}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="field-label">Para</label>
                <input className="input" value={contact.phone ?? ''} readOnly style={{ background: 'var(--bg-sunken)', color: 'var(--text-muted)' }} />
              </div>
              <div>
                <label className="field-label">Mensaje <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}>(opcional — se pre-carga en WhatsApp y queda registrado)</span></label>
                <textarea
                  className="input"
                  rows={5}
                  placeholder="Escribí tu mensaje…"
                  value={waMessage}
                  onChange={e => setWaMessage(e.target.value)}
                  autoFocus
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => { setShowWaModal(false); setWaMessage('') }}>Cancelar</button>
              <button type="button" className="btn primary" onClick={handleWaSend} style={{ gap: 6 }}>
                <Icon name="whatsapp" size={13} /> Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompose && (
        <div className="modal-backdrop" onClick={() => setShowCompose(false)}>
          <div className="modal" style={{ width: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="send" size={16} /> Enviar email
              </h3>
              <button className="btn ghost sm icon" onClick={() => setShowCompose(false)}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <form onSubmit={sendEmail}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="field-label">Para</label>
                  <input className="input" value={contact.email ?? ''} readOnly style={{ background: 'var(--bg-sunken)', color: 'var(--text-muted)' }} />
                </div>
                <div>
                  <label className="field-label">Asunto</label>
                  <input
                    className="input"
                    placeholder="Asunto del email…"
                    value={compose.subject}
                    onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="field-label">Mensaje</label>
                  <textarea
                    className="input"
                    rows={12}
                    placeholder="Escribí tu mensaje…"
                    value={compose.body}
                    onChange={e => setCompose(c => ({ ...c, body: e.target.value }))}
                    onPaste={e => {
                      const html = e.clipboardData.getData('text/html')
                      if (!html) return
                      e.preventDefault()
                      const text = htmlClipboardToText(html)
                      const ta = e.currentTarget
                      const start = ta.selectionStart
                      const end   = ta.selectionEnd
                      setCompose(c => ({ ...c, body: c.body.slice(0, start) + text + c.body.slice(end) }))
                    }}
                    required
                    style={{ resize: 'vertical' }}
                  />
                </div>
                {sendError && (
                  <div style={{ fontSize: 12.5, color: 'var(--danger)', background: 'var(--danger-soft)', borderRadius: 6, padding: '8px 12px' }}>
                    {sendError}
                  </div>
                )}
              </div>
              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setShowCompose(false)}>Cancelar</button>
                <button type="submit" className="btn primary" disabled={sendingEmail || !compose.subject || !compose.body}>
                  <Icon name="send" size={13} />
                  {sendingEmail ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
