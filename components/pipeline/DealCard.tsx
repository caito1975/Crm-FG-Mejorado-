'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Deal } from '@/lib/types'
import { useCurrency } from '@/lib/useCurrency'
import Icon from '@/components/ui/Icon'

interface Props {
  deal: Deal
  isDragging?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export default function DealCard({ deal, isDragging, onEdit, onDelete }: Props) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging: isSortableDragging,
  } = useSortable({ id: deal.id })

  const { formatAmount } = useCurrency()
  const contact = deal.contact as any

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isSortableDragging ? 0.4 : 1,
      }}
      className={`kcard ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      {/* Title */}
      <div className="ktitle">{deal.title}</div>

      {/* Company */}
      {contact && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="building" size={11} />
          {contact.company || contact.name}
        </div>
      )}

      {/* Meta row */}
      <div className="kmeta">
        <span className="kamt">{formatAmount(deal.amount)}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{deal.probability}%</span>
        </span>
        {deal.close_date && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="calendar" size={11} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {new Date(deal.close_date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
            </span>
          </span>
        )}
      </div>

      {/* Actions - only shown on hover via pointer-events */}
      {(onEdit || onDelete) && (
        <div
          style={{
            display: 'flex', gap: 4, justifyContent: 'flex-end',
            marginTop: 2,
          }}
          onPointerDown={e => e.stopPropagation()}
        >
          {onEdit && (
            <button className="btn ghost sm icon" onClick={onEdit} title="Editar">
              <Icon name="edit" size={11} />
            </button>
          )}
          {onDelete && (
            <button
              className="btn ghost sm icon"
              onClick={onDelete}
              title="Eliminar"
              style={{ color: 'var(--danger)' }}
            >
              <Icon name="trash" size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
