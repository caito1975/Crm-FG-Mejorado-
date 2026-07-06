'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

interface TopbarProps {
  crumbs: { label: string; href?: string }[]
  actions?: React.ReactNode
  searchValue?: string
  onSearchChange?: (q: string) => void
  searchPlaceholder?: string
}

export default function Topbar({ crumbs, actions, searchValue, onSearchChange, searchPlaceholder }: TopbarProps) {
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function toggleSearch() {
    if (!onSearchChange) return
    if (searchOpen) {
      onSearchChange('')
      setSearchOpen(false)
    } else {
      setSearchOpen(true)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

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
        {onSearchChange && searchOpen ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 8px', height: 32 }}>
            <Icon name="search" size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={searchValue ?? ''}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder ?? 'Buscar…'}
              onKeyDown={e => e.key === 'Escape' && toggleSearch()}
              style={{ border: 0, background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--text)', width: 180 }}
            />
            {searchValue && (
              <button className="btn ghost icon" style={{ padding: '0 2px', height: 22, width: 22 }} onClick={() => onSearchChange('')}>
                <Icon name="x" size={12} />
              </button>
            )}
            <button className="btn ghost icon" style={{ padding: '0 2px', height: 22, width: 22 }} onClick={toggleSearch}>
              <Icon name="x" size={12} />
            </button>
          </div>
        ) : (
          <button className="btn ghost icon" onClick={toggleSearch} title="Buscar">
            <Icon name="search" size={14} />
          </button>
        )}
        <button className="btn ghost icon"><Icon name="bell" size={14} /></button>
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
        {actions}
      </div>
    </div>
  )
}
