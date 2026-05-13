'use client'
import { useState, useRef, useEffect } from 'react'
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import type { Deal, PipelineStage, Contact } from '@/lib/types'
import { useCurrency } from '@/lib/useCurrency'
import KanbanColumn from './KanbanColumn'
import DealCard from './DealCard'
import DealModal from './DealModal'
import Icon from '@/components/ui/Icon'
import Topbar from '@/components/layout/Topbar'

interface Props {
  userId: string
  isOwner?: boolean
  vendorAuthId?: string
  stages: PipelineStage[]
  initialDeals: Deal[]
  contacts: Pick<Contact, 'id' | 'name' | 'company'>[]
}

export default function KanbanBoard({ userId, isOwner = true, vendorAuthId, stages, initialDeals, contacts }: Props) {
  const supabase = createClient()
  const { formatAmount } = useCurrency()
  const [deals, setDeals]         = useState(initialDeals)
  const [activeId, setActiveId] = useState<string | null>(null)
  const originalStageRef        = useRef<string | null>(null)
  const [showModal, setShowModal]       = useState(false)
  const [editDeal, setEditDeal]         = useState<Deal | null>(null)
  const [defaultStage, setDefaultStage] = useState<string>('enviado')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', contact_id: '', date: '', time: '09:00' })
  const [savingTask, setSavingTask] = useState(false)
  const [taskCalMsg, setTaskCalMsg] = useState('')

  useEffect(() => {
    const fetchDeals = () =>
      supabase.from('deals').select('*, contact:contacts(id,name,company)').eq('user_id', userId)
        .then(({ data }) => data && setDeals(data as Deal[]))

    // Owners subscribe via user_id filter; vendors use assigned_to filter (user_id filter blocked by RLS for vendors)
    const realtimeFilter = vendorAuthId
      ? `assigned_to=eq.${vendorAuthId}`
      : `user_id=eq.${userId}`

    const ch = supabase.channel('pipeline-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals', filter: realtimeFilter }, fetchDeals)
      .subscribe()

    const timer = setInterval(fetchDeals, 15_000)
    return () => { supabase.removeChannel(ch); clearInterval(timer) }
  }, [userId, vendorAuthId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const activeDeal = activeId ? deals.find(d => d.id === activeId) : null

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
    originalStageRef.current = deals.find(d => d.id === active.id)?.stage_id ?? null
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const activeStage = deals.find(d => d.id === active.id)?.stage_id
    // over.id can be either a deal id or a stage id (column drop)
    const overStage = deals.find(d => d.id === over.id)?.stage_id
      ?? (stages.find(s => s.id === over.id)?.id)
    if (!activeStage || !overStage || activeStage === overStage) return
    setDeals(ds => ds.map(d => d.id === active.id ? { ...d, stage_id: overStage } : d))
  }

  const STAGE_TO_STATUS: Record<string, string> = {
    ganado:       'cliente',
    perdido:      'archivado',
    enviado:      'enviado',
    contactar:    'contactar',
    contactado:   'contactado',
    interesado:   'interesado',
    oportunidad:  'oportunidad',
    reu_inicial:  'oportunidad',
    seg_reu:      'oportunidad',
    prop_enviada: 'oportunidad',
    doc_enviada:  'oportunidad',
    doc_firmada:  'oportunidad',
    ped_fc:       'oportunidad',
  }

  async function syncContactStatus(contactId: string | null | undefined, stageId: string) {
    if (!contactId) return
    const status = STAGE_TO_STATUS[stageId] ?? 'oportunidad'
    const { error } = await supabase.from('contacts').update({ status }).eq('id', contactId)
    if (error) console.error('[syncContactStatus] error:', error.message, { contactId, stageId, status })
  }

  async function syncContactValue(contactId: string | null | undefined, currentDeals: Deal[]) {
    if (!contactId) return
    const total = currentDeals
      .filter(d => d.contact_id === contactId && d.stage_id !== 'perdido')
      .reduce((s, d) => s + (d.amount ?? 0), 0)
    await supabase.from('contacts').update({ value: total }).eq('id', contactId)
  }

  async function handleDragEnd({ active }: DragEndEvent) {
    setActiveId(null)
    const prevStage = originalStageRef.current
    originalStageRef.current = null
    if (!prevStage) return

    const deal = deals.find(d => d.id === active.id)
    if (!deal) return

    // deal.stage_id was already updated optimistically; use prevStage to detect actual change
    const targetStage = deal.stage_id

    if (targetStage !== prevStage) {
      const { error } = await supabase
        .from('deals')
        .update({ stage_id: targetStage })
        .eq('id', deal.id)

      if (error) {
        setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, stage_id: prevStage } : d))
      } else {
        await syncContactStatus(deal.contact_id, targetStage)
        await syncContactValue(deal.contact_id, deals)
        await supabase.from('activities').insert({
          user_id: userId,
          kind: 'stage_change',
          who: 'tú',
          body: `Deal movido a "${stages.find(s => s.id === targetStage)?.label}"`,
          deal_id: deal.id,
          contact_id: deal.contact_id,
        })
        const contactInfo = contacts.find(c => c.id === deal.contact_id)
        if (contactInfo) {
          await supabase.from('historial_leads').insert({
            user_id:        userId,
            fecha:          new Date().toISOString(),
            nombre:         contactInfo.name,
            numero:         null,
            tipo:           'CAMBIO_ESTADO',
            mensaje:        `Deal movido a "${stages.find(s => s.id === targetStage)?.label}"`,
            etapa_anterior: (STAGE_TO_STATUS[prevStage] ?? prevStage).toUpperCase(),
            etapa_nueva:    (STAGE_TO_STATUS[targetStage] ?? targetStage).toUpperCase(),
            vendedor:       deal.owner_name ?? null,
            contact_id:     deal.contact_id,
          })
        }
      }
    }
  }

  async function handleSaveDeal(data: Partial<Deal>) {
    if (editDeal) {
      const { data: updated } = await supabase
        .from('deals').update(data).eq('id', editDeal.id)
        .select('*, contact:contacts(id,name,company)').single()
      if (updated) {
        const newDeals = deals.map(d => d.id === editDeal.id ? updated as Deal : d)
        setDeals(newDeals)
        if (data.stage_id) {
          await syncContactStatus(updated.contact_id, data.stage_id)
          const contactInfo = contacts.find(c => c.id === updated.contact_id)
          if (contactInfo && data.stage_id !== editDeal.stage_id) {
            await supabase.from('historial_leads').insert({
              user_id:        userId,
              fecha:          new Date().toISOString(),
              nombre:         contactInfo.name,
              numero:         null,
              tipo:           'CAMBIO_ESTADO',
              mensaje:        `Etapa cambiada a "${stages.find(s => s.id === data.stage_id)?.label}"`,
              etapa_anterior: (STAGE_TO_STATUS[editDeal.stage_id] ?? editDeal.stage_id).toUpperCase(),
              etapa_nueva:    (STAGE_TO_STATUS[data.stage_id] ?? data.stage_id).toUpperCase(),
              vendedor:       (updated as Deal).owner_name ?? null,
              contact_id:     updated.contact_id,
            })
          }
        }
        await syncContactValue(updated.contact_id, newDeals)
      }
    } else {
      const stageId = (data.stage_id as string) || defaultStage
      const autoAssign = !isOwner && vendorAuthId ? { assigned_to: vendorAuthId } : {}
      const { data: created } = await supabase
        .from('deals').insert({ ...data, ...autoAssign, user_id: userId, stage_id: stageId })
        .select('*, contact:contacts(id,name,company)').single()
      if (created) {
        const newDeals = [...deals, created as Deal]
        setDeals(newDeals)
        await syncContactStatus(created.contact_id, stageId)
        await syncContactValue(created.contact_id, newDeals)
        const contactInfo = contacts.find(c => c.id === created.contact_id)
        if (contactInfo) {
          await supabase.from('historial_leads').insert({
            user_id:        userId,
            fecha:          new Date().toISOString(),
            nombre:         contactInfo.name,
            numero:         null,
            tipo:           'ASIGNACION',
            mensaje:        `Deal creado en "${stages.find(s => s.id === stageId)?.label}"`,
            etapa_anterior: 'NO_ENVIADO',
            etapa_nueva:    (STAGE_TO_STATUS[stageId] ?? stageId).toUpperCase(),
            vendedor:       (created as Deal).owner_name ?? null,
            contact_id:     created.contact_id,
          })
        }
      }
    }
    setShowModal(false)
    setEditDeal(null)
  }

  async function handleDeleteDeal(id: string) {
    if (!confirm('¿Eliminar este deal?')) return
    const deal = deals.find(d => d.id === id)
    await supabase.from('deals').delete().eq('id', id)
    const newDeals = deals.filter(d => d.id !== id)
    setDeals(newDeals)
    if (deal?.contact_id) await syncContactValue(deal.contact_id, newDeals)
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault()
    setSavingTask(true)
    setTaskCalMsg('')

    const due_date = taskForm.date && taskForm.time
      ? new Date(`${taskForm.date}T${taskForm.time}:00`).toISOString()
      : null

    const due_label = taskForm.date
      ? `${taskForm.date.split('-').reverse().join('/')} ${taskForm.time} hs`
      : ''

    const contact = contacts.find(c => c.id === taskForm.contact_id)

    const { data: created } = await supabase.from('tasks').insert({
      user_id:    userId,
      title:      taskForm.title,
      contact_id: taskForm.contact_id || null,
      due_date,
      due_label,
      priority:   'media',
    }).select().single()

    if (created && due_date) {
      const res = await fetch('/api/integrations/calendar/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:        taskForm.title,
          due_date,
          contact_name: contact?.name ?? null,
          contact_id:   taskForm.contact_id || null,
        }),
      })
      const calData = await res.json()
      if (calData.calendar) setTaskCalMsg('✓ Agregado al calendario')
      else if (calData.reason === 'sin_integracion') setTaskCalMsg('Guardado · Calendar no conectado')
      else if (calData.reason === 'sin_permiso') setTaskCalMsg('Guardado · Reconectá Calendar para sincronizar')
      else setTaskCalMsg('Guardado · sin sincronía con Calendar')
    }

    setSavingTask(false)
    setTaskForm({ title: '', contact_id: '', date: '', time: '09:00' })
    setTimeout(() => { setShowTaskModal(false); setTaskCalMsg('') }, 1800)
  }

  function openNewDeal(stageId: string) {
    setDefaultStage(stageId)
    setEditDeal(null)
    setShowModal(true)
  }

  const totalPipeline = deals
    .filter(d => d.stage_id !== 'ganado' && d.stage_id !== 'perdido')
    .reduce((s, d) => s + d.amount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <Topbar
        crumbs={[{ label: 'Pipeline' }]}
        actions={
          <>
            {!isOwner && (
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                textTransform: 'uppercase', padding: '2px 8px',
                background: 'var(--accent-soft)', color: 'var(--accent)',
                borderRadius: 6, border: '1px solid var(--accent)',
              }}>
                Mis deals
              </span>
            )}
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)', marginRight: 4 }}>
              <b style={{ color: 'var(--text)' }}>{deals.filter(d => d.stage_id !== 'perdido').length}</b> deals
              {' · '}
              <b style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatAmount(totalPipeline)}</b>
            </span>
            <button className="btn" onClick={() => { setTaskForm({ title: '', contact_id: '', date: '', time: '09:00' }); setTaskCalMsg(''); setShowTaskModal(true) }}>
              <Icon name="tasks" size={13} /> Nueva tarea
            </button>
            <button className="btn primary" onClick={() => { setEditDeal(null); setShowModal(true) }}>
              <Icon name="plus" size={13} /> Nuevo deal
            </button>
          </>
        }
      />

      {/* Kanban board */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="kanban">
            {stages.map(stage => {
              const stageDeals = deals.filter(d => d.stage_id === stage.id)
              return (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  deals={stageDeals}
                  onAddDeal={() => openNewDeal(stage.id)}
                  onAddTask={(deal) => { setTaskForm({ title: '', contact_id: deal.contact_id ?? '', date: '', time: '09:00' }); setTaskCalMsg(''); setShowTaskModal(true) }}
                  onEditDeal={(d) => { setEditDeal(d); setShowModal(true) }}
                  onDeleteDeal={handleDeleteDeal}
                />
              )
            })}
          </div>

          <DragOverlay>
            {activeDeal ? <DealCard deal={activeDeal} isDragging /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {showTaskModal && (
        <div className="modal-backdrop" onClick={() => setShowTaskModal(false)}>
          <div className="modal" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="tasks" size={16} /> Nueva tarea
              </h3>
              <button className="btn ghost sm icon" onClick={() => setShowTaskModal(false)}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="field-label">Nombre de la tarea</label>
                  <input
                    className="input"
                    placeholder="Ej: Llamar, Reunión, Seguimiento…"
                    value={taskForm.title}
                    onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="field-label">Contacto</label>
                  <select
                    className="input"
                    value={taskForm.contact_id}
                    onChange={e => setTaskForm(f => ({ ...f, contact_id: e.target.value }))}
                  >
                    <option value="">Sin contacto</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="field-label">Fecha</label>
                    <input
                      className="input"
                      type="date"
                      value={taskForm.date}
                      onChange={e => setTaskForm(f => ({ ...f, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="field-label">Hora</label>
                    <input
                      className="input"
                      type="time"
                      value={taskForm.time}
                      onChange={e => setTaskForm(f => ({ ...f, time: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                {taskForm.title && taskForm.date && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', background: 'var(--bg-sunken)', borderRadius: 6, padding: '8px 12px' }}>
                    <Icon name="calendar" size={12} style={{ marginRight: 6 }} />
                    {taskForm.title}{taskForm.contact_id ? ` · ${contacts.find(c => c.id === taskForm.contact_id)?.name}` : ''} — {taskForm.date.split('-').reverse().join('/')} a las {taskForm.time} hs
                  </div>
                )}
                {taskCalMsg && (
                  <div style={{ fontSize: 12.5, color: taskCalMsg.startsWith('✓') ? 'var(--success)' : 'var(--text-muted)', background: 'var(--bg-sunken)', borderRadius: 6, padding: '8px 12px' }}>
                    {taskCalMsg}
                  </div>
                )}
              </div>
              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setShowTaskModal(false)}>Cancelar</button>
                <button type="submit" className="btn primary" disabled={savingTask || !taskForm.title || !taskForm.date}>
                  <Icon name="check" size={13} />
                  {savingTask ? 'Guardando…' : 'Guardar tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <DealModal
          deal={editDeal}
          defaultStageId={defaultStage}
          stages={stages}
          contacts={contacts}
          onSave={handleSaveDeal}
          onClose={() => { setShowModal(false); setEditDeal(null) }}
        />
      )}
    </div>
  )
}
