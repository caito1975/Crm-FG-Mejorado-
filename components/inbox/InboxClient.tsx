'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { InboxMessage } from '@/lib/types'
import Icon from '@/components/ui/Icon'
import Avatar from '@/components/ui/Avatar'

const LABELS_COLORS: Record<string, string> = {
  cliente:     'success',
  propuesta:   'accent',
  prioridad:   'danger',
  facturación: 'warning',
  archivado:   '',
}

interface Props {
  userId: string
  initialMessages: InboxMessage[]
}

export default function InboxClient({ userId, initialMessages }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState(initialMessages)
  const [selected, setSelected] = useState<InboxMessage | null>(initialMessages[0] ?? null)
  const [filter, setFilter]     = useState<'all' | 'unread' | 'starred'>('all')
  const [reply, setReply]       = useState('')

  const filtered = messages.filter(m => {
    if (filter === 'unread')  return m.unread
    if (filter === 'starred') return m.starred
    return true
  })

  async function markRead(id: string) {
    await supabase.from('inbox_messages').update({ unread: false }).eq('id', id)
    setMessages(ms => ms.map(m => m.id === id ? { ...m, unread: false } : m))
  }

  async function toggleStar(id: string) {
    const msg = messages.find(m => m.id === id)
    if (!msg) return
    await supabase.from('inbox_messages').update({ starred: !msg.starred }).eq('id', id)
    setMessages(ms => ms.map(m => m.id === id ? { ...m, starred: !m.starred } : m))
  }

  function selectMessage(msg: InboxMessage) {
    setSelected(msg)
    if (msg.unread) markRead(msg.id)
  }

  const unreadCount = messages.filter(m => m.unread).length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', height: '100%', overflow: 'hidden' }}>
      {/* Left sidebar */}
      <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-sunken)' }}>
        <div style={{ padding: '14px 12px', borderBottom: '1px solid var(--border)' }}>
          <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
            <Icon name="edit" size={13} /> Redactar
          </button>
        </div>
        <nav style={{ padding: '8px 6px', flex: 1 }}>
          {[
            { key: 'all',     label: 'Todos',     icon: 'inbox',    count: messages.length },
            { key: 'unread',  label: 'No leídos',  icon: 'mail',     count: unreadCount },
            { key: 'starred', label: 'Destacados', icon: 'star',     count: messages.filter(m => m.starred).length },
          ].map(f => (
            <div
              key={f.key}
              className={`nav-item ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key as any)}
            >
              <span className="nav-ico"><Icon name={f.icon} size={14} /></span>
              <span>{f.label}</span>
              {f.count > 0 && <span className="nav-count">{f.count}</span>}
            </div>
          ))}
        </nav>
      </div>

      {/* Message list */}
      <div style={{ borderRight: '1px solid var(--border)', overflow: 'auto' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{filtered.length} mensajes</span>
        </div>
        {filtered.map(msg => (
          <div
            key={msg.id}
            onClick={() => selectMessage(msg)}
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
              cursor: 'default',
              background: selected?.id === msg.id ? 'var(--bg-active)' : msg.unread ? 'var(--bg-panel)' : 'var(--bg)',
              transition: 'background var(--tx)',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
              <Avatar name={msg.from_name || '?'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, fontWeight: msg.unread ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {msg.from_name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-subtle)', flexShrink: 0, marginLeft: 8 }}>{msg.sent_label}</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: msg.unread ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {msg.subject}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {msg.preview}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {msg.labels.map(l => (
                <span key={l} className={`pill ${LABELS_COLORS[l] || ''}`} style={{ fontSize: 10, height: 16 }}>{l}</span>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="empty"><p>Sin mensajes.</p></div>}
      </div>

      {/* Message detail */}
      {selected ? (
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{selected.subject}</h2>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn ghost sm icon" onClick={() => toggleStar(selected.id)}>
                  <Icon name={selected.starred ? 'star_fill' : 'star'} size={14} style={{ color: selected.starred ? 'oklch(72% 0.15 75)' : undefined }} />
                </button>
                <button className="btn ghost sm icon"><Icon name="archive" size={14} /></button>
                <button className="btn ghost sm icon"><Icon name="trash" size={14} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Avatar name={selected.from_name || '?'} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{selected.from_name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{selected.sent_label}</div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text)', margin: 0 }}>
              {selected.body || selected.preview}
            </p>
          </div>

          {/* Reply */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              <textarea
                style={{ width: '100%', border: 0, padding: '10px 12px', fontSize: 13, lineHeight: 1.6, background: 'var(--bg-panel)', color: 'var(--text)', resize: 'none', outline: 'none', fontFamily: 'var(--font-sans)' }}
                rows={3}
                placeholder={`Responder a ${selected.from_name}…`}
                value={reply}
                onChange={e => setReply(e.target.value)}
              />
              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-sunken)' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn ghost sm icon"><Icon name="link" size={13} /></button>
                  <button className="btn ghost sm icon"><Icon name="sparkles" size={13} /></button>
                </div>
                <button className="btn primary sm" disabled={!reply.trim()}>
                  <Icon name="send" size={12} /> Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty">
          <p>Seleccioná un mensaje para leerlo.</p>
        </div>
      )}
    </div>
  )
}
