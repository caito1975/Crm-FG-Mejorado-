'use client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

interface TopbarProps {
  crumbs: { label: string; href?: string }[]
  actions?: React.ReactNode
}

export default function Topbar({ crumbs, actions }: TopbarProps) {
  const router = useRouter()
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && (
              <span className="sep"><Icon name="chev_right" size={12} /></span>
            )}
            <span
              className={`crumb ${i === crumbs.length - 1 ? 'current' : ''}`}
              onClick={c.href ? () => router.push(c.href!) : undefined}
              style={c.href ? { cursor: 'default' } : undefined}
            >
              {c.label}
            </span>
          </span>
        ))}
      </div>
      <div className="topbar-spacer" />
      <div className="topbar-actions">
        <button className="btn ghost icon"><Icon name="search" size={14} /></button>
        <button className="btn ghost icon"><Icon name="bell" size={14} /></button>
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
        {actions}
      </div>
    </div>
  )
}
