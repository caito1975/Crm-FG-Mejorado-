'use client'
import { useState, useRef } from 'react'
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

interface Props {
  userId: string
  stages: PipelineStage[]
  initialDeals: Deal[]
  contacts: Pick<Contact, 'id' | 'name' | 'company'>[]
}

export default function KanbanBoard({ userId, stages, initialDeals, contacts }: Props) {
  const supabase = createClient()
  const { formatAmount } = useCurrency()
  const [deals, setDeals]         = useState(initialDeals)
  const [activeId, setActiveId] = useState<string | null>(null)
  const originalStageRef        = useRef<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editDeal, setEditDeal]   = useState<Deal | null>(null)
  const [defaultStage, setDefaultStage] = useState<string>('enviado')

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
    ganado: 'cliente', perdido: 'archivado', enviado: 'enviado',
    enviar_mail: 'enviar_mail', interesado: 'interesado', oportunidad: 'oportunidad',
  }

  async function syncContactStatus(contactId: string | null | undefined, stageId: string) {
    if (!contactId) return
    const status = STAGE_TO_STATUS[stageId] ?? 'oportunidad'
    await supabase.from('contacts').update({ status }).eq('id', contactId)
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
      const { data: created } = await supabase
        .from('deals').insert({ ...data, user_id: userId, stage_id: stageId })
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

  function openNewDeal(stageId: string) {
    setDefaultStage(stageId)
    setEditDeal(null)
    setShowModal(true)
  }

  const totalPipeline = deals
    .filter(d => d.stage_id !== 'ganado' && d.stage_id !== 'perdido')
    .reduce((s, d) => s + d.amount, 0)

  return (
    <>
      {/* Pipeline header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          <b style={{ color: 'var(--text)' }}>{deals.filter(d => d.stage_id !== 'perdido').length}</b> deals ·{' '}
          <b style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatAmount(totalPipeline)}</b> en pipeline
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => { setEditDeal(null); setShowModal(true) }}>
            <Icon name="plus" size={13} /> Nuevo deal
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div style={{ flex: 1, overflow: 'auto', height: 'calc(100% - 49px)' }}>
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
    </>
  )
}
