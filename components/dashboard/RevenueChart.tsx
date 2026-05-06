'use client'
import type { Deal } from '@/lib/types'
import { useCurrency } from '@/lib/useCurrency'

const STAGE_LABELS: Record<string, string> = {
  enviado:      'Enviado',
  contactar:    'Contactar',
  contactado:   'Contactado',
  interesado:   'Interesado',
  reu_inicial:  'Reu. Inicial',
  seg_reu:      'Seg. Reunión',
  prop_enviada: 'Prop. Enviada',
  doc_enviada:  'Doc. Enviada',
  doc_firmada:  'Doc. Firmada',
  ped_fc:       'Ped. de FC',
  ganado:       'Ganado',
  perdido:      'Perdido',
}

const STAGE_COLORS: Record<string, string> = {
  enviado:      'oklch(68% 0.08 230)',
  contactar:    'oklch(70% 0.10 200)',
  contactado:   'oklch(68% 0.12 195)',
  interesado:   'oklch(65% 0.14 200)',
  reu_inicial:  'oklch(65% 0.11 230)',
  seg_reu:      'oklch(65% 0.13 260)',
  prop_enviada: 'oklch(68% 0.14 305)',
  doc_enviada:  'oklch(65% 0.13 280)',
  doc_firmada:  'oklch(62% 0.14 145)',
  ped_fc:       'oklch(70% 0.14 75)',
  ganado:       'oklch(58% 0.15 155)',
  perdido:      'oklch(60% 0.14 25)',
}

const STAGE_ORDER = ['enviado','contactar','contactado','interesado','reu_inicial','seg_reu','prop_enviada','doc_enviada','doc_firmada','ped_fc','ganado','perdido']

export default function RevenueChart({ deals }: { deals: Deal[] }) {
  const { formatAmount } = useCurrency()
  const byStage = STAGE_ORDER.map(id => ({
    id,
    label: STAGE_LABELS[id] || id,
    color: STAGE_COLORS[id] || 'var(--accent)',
    amount: deals.filter(d => d.stage_id === id).reduce((s, d) => s + d.amount, 0),
    count: deals.filter(d => d.stage_id === id).length,
  })).filter(s => s.count > 0)

  const maxAmount = Math.max(...byStage.map(s => s.amount), 1)

  if (byStage.length === 0) {
    return (
      <div className="empty" style={{ padding: '32px 0' }}>
        <p>No hay deals. Creá tu primer deal en el pipeline.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {byStage.map(s => (
        <div key={s.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />
              {s.label}
              <span style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                ({s.count})
              </span>
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 11 }}>
              {formatAmount(s.amount)}
            </span>
          </div>
          <div className="bar">
            <span style={{ width: `${(s.amount / maxAmount) * 100}%`, background: s.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}
