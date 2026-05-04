'use client'
import { useState, useCallback } from 'react'
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { createClient } from '@/lib/supabase/client'
import type { Deal, PipelineStage, Contact, ContactStatus } from '@/lib/types'
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
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editDeal, setEditDeal]   = useState<Deal | null>(null)
  const [defaultStage, setDefaultStage] = useState<string>('enviado')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const activeDeal = activeId ? deals.find(d => d.id === activeId) : null

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
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

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return

    const deal = deals.find(d => d.id === active.id)
    if (!deal) return

    // Find target stage (from over's deal or column)
    const targetStage = deals.find(d => d.id === over.id)?.stage_id
      ?? (stages.find(s => s.id === over.id)?.id)
      ?? deal.stage_id

    if (targetStage !== deal.stage_id) {
      // Already updated optimistically in handleDragOver; persist to DB
      const { error } = await supabase
        .from('deals')
        .update({ stage_id: targetStage })
        .eq('id', deal.id)

      if (error) {
        // Rollback
        setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, stage_id: deal.stage_id } : d))
      } else {
        // Sync contact status to reflect pipeline position
        if (deal.contact_id) {
          const contactStatus: ContactStatus =
            targetStage === 'ganado'  ? 'cliente'
            : targetStage === 'perdido' ? 'archivado'
            : 'oportunidad'
          await supabase.from('contacts').update({ status: contactStatus }).eq('id', deal.contact_id)
        }
        // Log activity
        await supabase.from('activities').insert({
          user_id: userId,
          kind: 'stage_change',
          who: 'tú',
          body: `Deal movido a "${stages.find(s => s.id === targetStage)?.label}"`,
          deal_id: deal.id,
          contact_id: deal.contact_id,
        })
      }
    }
  }

  async function handleSaveDeal(data: Partial<Deal>) {
    if (editDeal) {
      const { data: updated } = await supabase
        .from('deals').update(data).eq('id', editDeal.id)
        .select('*, contact:contacts(id,name,company)').single()
      if (updated) setDeals(ds => ds.map(d => d.id === editDeal.id ? updated as Deal : d))
    } else {
      const { data: created } = await supabase
        .from('deals').insert({ ...data, user_id: userId, stage_id: defaultStage })
        .select('*, contact:contacts(id,name,company)').single()
      if (created) setDeals(ds => [...ds, created as Deal])
    }
    setShowModal(false)
    setEditDeal(null)
  }

  async function handleDeleteDeal(id: string) {
    if (!confirm('¿Eliminar este deal?')) return
    await supabase.from('deals').delete().eq('id', id)
    setDeals(ds => ds.filter(d => d.id !== id))
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
