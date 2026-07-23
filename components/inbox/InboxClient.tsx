'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { InboxMessage } from '@/lib/types'
import Icon from '@/components/ui/Icon'
import Avatar from '@/components/ui/Avatar'

type Channel = 'wa' | 'email'
type SendStatus = { type: 'ok' | 'err'; msg: string } | null
type ContactInfo = { id: string; phone: string | null; email: string | null } | null

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
  senderName: string | null
}

export default function InboxClient({ userId, initialMessages, senderName }: Props) {
  const supabase = createClient()
  const [messages, setMessages]       = useState(initialMessages)
  const [selected, setSelected]       = useState<InboxMessage | null>(null)
  const [filter, setFilter]           = useState<'all' | 'unread' | 'starred'>('all')
  const [reply, setReply]             = useState('')
  const [channel, setChannel]         = useState<Channel>('wa')
  const [contactInfo, setContactInfo] = useState<ContactInfo>(null)
  const [sending, setSending]         = useState(false)
  const [sendStatus, setSendStatus]   = useState<SendStatus>(null)

  // Select first message after mount to avoid SSR/hydration mismatch
  useEffect(() => {
    if (initialMessages[0]) setSelected(initialMessages[0])
  }, [])

  useEffect(() => {
    setSendStatus(null)
    if (!selected?.from_name) { setContactInfo(null); return }
    supabase
      .from('contacts')
      .select('id, phone, email')
      .eq('user_id', userId)
      .eq('name', selected.from_name)
      .maybeSingle()
      .then(({ data }) => setContactInfo(data ? { id: data.id, phone: data.phone ?? null, email: data.email ?? null } : null))
  }, [selected?.id])

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
    setReply('')
    setSendStatus(null)
    if (msg.unread) markRead(msg.id)
  }

  async function handleSend() {
    if (!reply.trim() || !selected || sending) return
    setSending(true)
    setSendStatus(null)
    try {
      if (channel === 'wa') {
        if (!contactInfo?.phone) {
          setSendStatus({ type: 'err', msg: 'Sin número WA para este contacto.' })
          return
        }
        const res  = await fetch('/api/wa/send', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ phone: contactInfo.phone, message: reply, contact_id: contactInfo.id }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error al enviar')
        if (contactInfo.id) {
          supabase.from('historial_leads').insert({
            user_id: userId, fecha: new Date().toISOString(),
            nombre: selected.from_name ?? '', numero: contactInfo.phone ?? null,
            tipo: 'WHATSAPP', mensaje: reply.slice(0, 300),
            etapa_anterior: null, etapa_nueva: null,
            vendedor: senderName, contact_id: contactInfo.id,
          }).then()
        }
      } else {
        if (!contactInfo?.email) {
          setSendStatus({ type: 'err', msg: 'Sin email para este contacto.' })
          return
        }
        const res  = await fetch('/api/integrations/gmail/send', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ to: contactInfo.email, subject: `Re: ${selected.subject ?? ''}`, body: reply, contact_id: contactInfo.id }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error al enviar')
        if (contactInfo.id) {
          supabase.from('historial_leads').insert({
            user_id: userId, fecha: new Date().toISOString(),
            nombre: selected.from_name ?? '', numero: null,
            tipo: 'EMAIL', mensaje: `Re: ${selected.subject ?? ''}`.slice(0, 300),
            etapa_anterior: null, etapa_nueva: null,
            vendedor: senderName, contact_id: contactInfo.id,
          }).then()
        }
      }
      setSendStatus({ type: 'ok', msg: channel === 'wa' ? 'Mensaje enviado por WhatsApp ✓' : 'Email enviado ✓' })
      setReply('')
    } catch (e: any) {
      setSendStatus({ type: 'err', msg: e.message })
    } finally {
      setSending(false)
    }
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
            {/* Channel selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <button
                className={`btn sm ${channel === 'wa' ? 'primary' : 'ghost'}`}
                onClick={() => { setChannel('wa'); setSendStatus(null) }}
                style={{ gap: 5 }}
              >
                <Icon name="phone" size={12} /> WhatsApp
              </button>
              <button
                className={`btn sm ${channel === 'email' ? 'primary' : 'ghost'}`}
                onClick={() => { setChannel('email'); setSendStatus(null) }}
                style={{ gap: 5 }}
              >
                <Icon name="mail" size={12} /> Email
              </button>
              {contactInfo && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                  {channel === 'wa'
                    ? (contactInfo.phone ? `📱 ${contactInfo.phone}` : '⚠ Sin teléfono')
                    : (contactInfo.email ? `✉ ${contactInfo.email}` : '⚠ Sin email')
                  }
                </span>
              )}
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              <textarea
                style={{ width: '100%', border: 0, padding: '10px 12px', fontSize: 13, lineHeight: 1.6, background: 'var(--bg-panel)', color: 'var(--text)', resize: 'none', outline: 'none', fontFamily: 'var(--font-sans)' }}
                rows={3}
                placeholder={channel === 'wa' ? `Mensaje WA a ${selected.from_name}…` : `Email a ${selected.from_name}…`}
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend() }}
              />
              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-sunken)' }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {sendStatus && (
                    <span style={{ fontSize: 11.5, color: sendStatus.type === 'ok' ? 'var(--success)' : 'var(--danger)', marginRight: 4 }}>
                      {sendStatus.msg}
                    </span>
                  )}
                </div>
                <button
                  className="btn primary sm"
                  disabled={!reply.trim() || sending}
                  onClick={handleSend}
                >
                  {sending ? '…' : <><Icon name="send" size={12} /> {channel === 'wa' ? 'Enviar WA' : 'Enviar Email'}</>}
                </button>
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', marginTop: 5 }}>Ctrl+Enter para enviar</div>
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
