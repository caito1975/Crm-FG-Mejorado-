'use client'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Deal, PipelineStage } from '@/lib/types'
import { useCurrency } from '@/lib/useCurrency'
import DealCard from './DealCard'
import Icon from '@/components/ui/Icon'

interface Props {
  stage: PipelineStage
  deals: Deal[]
  onAddDeal: () => void
  onEditDeal: (deal: Deal) => void
  onDeleteDeal: (id: string) => void
}

export default function KanbanColumn({ stage, deals, onAddDeal, onEditDeal, onDeleteDeal }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const { formatAmount } = useCurrency()
  const total = deals.reduce((s, d) => s + d.amount, 0)

  return (
    <div
      ref={setNodeRef}
      className="kcol"
      style={{
        outline: isOver ? `2px solid ${stage.color}` : undefined,
        outlineOffset: 2,
        transition: 'outline 100ms',
      }}
    >
      {/* Column header */}
      <div className="kcol-head">
        <span className="swatch" style={{ background: stage.color }} />
        <h4>{stage.label}</h4>
        <span className="count">{deals.length}</span>
        {total > 0 && (
          <span className="sum">
            {formatAmount(total)}
          </span>
        )}
      </div>

      {/* Cards */}
      <SortableContext
        items={deals.map(d => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="kcol-body scroll-thin">
          {deals.map(deal => (
            <DealCard
              key={deal.id}
              deal={deal}
              onEdit={() => onEditDeal(deal)}
              onDelete={() => onDeleteDeal(deal.id)}
            />
          ))}
        </div>
      </SortableContext>

      {/* Add deal button */}
      <button
        onClick={onAddDeal}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '8px 14px',
          background: 'transparent', border: 0,
          borderTop: deals.length > 0 ? '1px solid var(--border)' : 'none',
          color: 'var(--text-muted)', fontSize: 12.5,
          cursor: 'default',
          transition: 'background var(--tx)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Icon name="plus" size={13} /> Agregar deal
      </button>
    </div>
  )
}
