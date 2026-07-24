'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Icon from '@/components/ui/Icon'
import Avatar from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  titulo: string
  mensaje: string | null
  contact_id: string | null
  leida: boolean
  created_at: string
}

interface NavItem {
  id: string
  label: string
  icon: string
  count?: number
  href: string
}

interface SidebarProps {
  userName: string
  userRole: string
  isOwner: boolean
  currentUserId: string
  contactCount: number
  dealCount: number
  taskCount: number
  teamCount: number
  inboxCount: number
}

export default function Sidebar({
  userName,
  userRole,
  isOwner,
  currentUserId,
  contactCount,
  dealCount,
  taskCount,
  teamCount,
  inboxCount,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [notifs, setNotifs]         = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const unread = notifs.filter(n => !n.leida).length

  useEffect(() => {
    const fetchNotifs = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, titulo, mensaje, contact_id, leida, created_at')
        .eq('for_user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) console.error('[notifications] fetch error:', error.message)
      if (data) setNotifs(data as Notification[])
    }

    fetchNotifs()
    const timer = setInterval(fetchNotifs, 30_000)
    return () => clearInterval(timer)
  }, [currentUserId])

  // Cerrar panel al hacer click fuera
  useEffect(() => {
    if (!showNotifs) return
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showNotifs])

  async function markRead(id: string, contactId: string | null) {
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, leida: true } : n))
    await supabase.from('notifications').update({ leida: true }).eq('id', id)
    if (contactId) router.push(`/contacts/${contactId}`)
    setShowNotifs(false)
  }

  async function markAllRead() {
    const ids = notifs.filter(n => !n.leida).map(n => n.id)
    if (!ids.length) return
    setNotifs(ns => ns.map(n => ({ ...n, leida: true })))
    await supabase.from('notifications').update({ leida: true }).in('id', ids)
  }

  const nav: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard',          icon: 'dashboard', href: '/dashboard' },
    { id: 'contacts',  label: 'Contactos',          icon: 'contacts',  href: '/contacts',  count: contactCount },
    { id: 'pipeline',  label: 'Pipeline',           icon: 'pipeline',  href: '/pipeline',  count: dealCount },
    { id: 'tasks',     label: 'Tareas',             icon: 'tasks',     href: '/tasks',     count: taskCount },
    { id: 'calendar',  label: 'Calendario',         icon: 'calendar',  href: '/calendar' },
    { id: 'reports',   label: 'Reportes',           icon: 'reports',   href: '/reports' },
    { id: 'inbox',     label: 'Inbox',              icon: 'inbox',     href: '/inbox',     count: inboxCount },
    ...(isOwner ? [{ id: 'team', label: 'Equipo',  icon: 'team',      href: '/team',      count: teamCount }] : []),
    { id: 'gestion',   label: 'Gestión Vendedores', icon: 'reports',   href: '/gestion' },
    { id: 'historial', label: 'Historial de Leads', icon: 'clock',     href: '/historial' },
  ]

  const saved = [
    { l: 'Mis deals abiertos',   i: 'pipeline', href: '/pipeline?mine=1' },
    { l: 'Clientes recurrentes', i: 'star',      href: '/contacts?status=cliente' },
    { l: 'Sin actividad +14d',   i: 'flag',      href: '/contacts?activity=stale' },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="crm-nav" role="complementary">
      {/* Header with logo */}
      <div
        className="sidebar-head"
        style={{ background: '#0d1117', borderBottomColor: 'rgba(255,255,255,.08)' }}
      >
        <div className="workspace" style={{ gap: 0 }}>
          <img
            src="/logo.png"
            alt="FG Medios"
            style={{ height: 40, maxWidth: '100%', objectFit: 'contain' }}
          />
          <span className="workspace-chev" style={{ color: 'rgba(255,255,255,.4)', marginLeft: 'auto' }}>
            <Icon name="chev_down" size={13} />
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <span className="ico"><Icon name="search" size={13} /></span>
        <input placeholder="Buscar" readOnly />
        <kbd>⌘K</kbd>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section">Espacio de trabajo</div>
        {nav.map(n => (
          <Link
            key={n.id}
            href={n.href}
            className={`nav-item ${isActive(n.href) ? 'active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <span className="nav-ico"><Icon name={n.icon} size={15} /></span>
            <span>{n.label}</span>
            {typeof n.count === 'number' && (
              <span className="nav-count">{n.count}</span>
            )}
          </Link>
        ))}

        <div className="nav-section">Vistas guardadas</div>
        {saved.map(s => (
          <Link
            key={s.l}
            href={s.href}
            className="nav-item"
            style={{ textDecoration: 'none' }}
          >
            <span className="nav-ico"><Icon name={s.i} size={14} /></span>
            <span>{s.l}</span>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-foot">
        <Avatar name={userName} tone="accent" />
        <div className="user-meta">
          <b>{userName}</b>
          <span>{userRole}</span>
        </div>

        {/* Notification bell */}
        <div ref={bellRef} style={{ position: 'relative' }}>
          <button
            className="btn ghost sm icon"
            title="Notificaciones"
            onClick={() => setShowNotifs(s => !s)}
            style={{ position: 'relative' }}
          >
            <Icon name="bell" size={14} />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                width: 16, height: 16, borderRadius: '50%',
                background: 'var(--danger)', color: '#fff',
                fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div style={{
              position: 'absolute', bottom: '110%', left: 0,
              width: 300, maxHeight: 380,
              background: 'var(--bg-panel)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', boxShadow: '0 8px 24px rgba(0,0,0,.25)',
              display: 'flex', flexDirection: 'column', zIndex: 9999,
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Notificaciones {unread > 0 && `(${unread})`}</span>
                {unread > 0 && (
                  <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Marcar todas como leídas
                  </button>
                )}
              </div>
              <div style={{ overflow: 'auto', flex: 1 }}>
                {notifs.length === 0 ? (
                  <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                    Sin notificaciones
                  </div>
                ) : notifs.map(n => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id, n.contact_id)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 14px',
                      borderBottom: '1px solid var(--border)',
                      background: n.leida ? 'transparent' : 'var(--accent-soft)',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: n.leida ? 'transparent' : 'var(--accent)', flexShrink: 0, marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: n.leida ? 400 : 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.titulo}
                      </div>
                      {n.mensaje && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{n.mensaje}</div>
                      )}
                      <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 3 }}>
                        {new Date(n.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Link href="/settings" className="btn ghost sm icon" title="Configuración">
          <Icon name="settings" size={14} />
        </Link>
        <button
          className="btn ghost sm icon"
          onClick={signOut}
          title="Cerrar sesión"
        >
          <Icon name="arrow_dn" size={14} />
        </button>
      </div>
    </div>
  )
}
