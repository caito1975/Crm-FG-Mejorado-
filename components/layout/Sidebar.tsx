'use client'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import Icon from '@/components/ui/Icon'
import Avatar from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/client'

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
  contactCount: number
  dealCount: number
  taskCount: number
  teamCount: number
  inboxCount: number
}

export default function Sidebar({
  userName,
  userRole,
  contactCount,
  dealCount,
  taskCount,
  teamCount,
  inboxCount,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const nav: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard',  icon: 'dashboard', href: '/dashboard' },
    { id: 'contacts',  label: 'Contactos',  icon: 'contacts',  href: '/contacts',  count: contactCount },
    { id: 'pipeline',  label: 'Pipeline',   icon: 'pipeline',  href: '/pipeline',  count: dealCount },
    { id: 'tasks',     label: 'Tareas',     icon: 'tasks',     href: '/tasks',     count: taskCount },
    { id: 'calendar',  label: 'Calendario', icon: 'calendar',  href: '/calendar' },
    { id: 'reports',   label: 'Reportes',   icon: 'reports',   href: '/reports' },
    { id: 'inbox',     label: 'Inbox',      icon: 'inbox',     href: '/inbox',     count: inboxCount },
    { id: 'team',      label: 'Equipo',     icon: 'team',      href: '/team',      count: teamCount },
  ]

  const saved = [
    { l: 'Mis deals abiertos',  i: 'pipeline' },
    { l: 'Clientes recurrentes', i: 'star' },
    { l: 'Sin actividad +14d',   i: 'flag' },
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
    <aside className="sidebar">
      {/* Header with logo */}
      <div
        className="sidebar-head"
        style={{ background: '#0d1117', borderBottomColor: 'rgba(255,255,255,.08)' }}
      >
        <div className="workspace" style={{ gap: 0 }}>
          <img
            src="/logo.png"
            alt="FG Medios"
            style={{ height: 28, maxWidth: '100%', objectFit: 'contain' }}
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
          <div
            key={n.id}
            className={`nav-item ${isActive(n.href) ? 'active' : ''}`}
            onClick={() => router.push(n.href)}
          >
            <span className="nav-ico"><Icon name={n.icon} size={15} /></span>
            <span>{n.label}</span>
            {typeof n.count === 'number' && (
              <span className="nav-count">{n.count}</span>
            )}
          </div>
        ))}

        <div className="nav-section">Vistas guardadas</div>
        {saved.map(s => (
          <div key={s.l} className="nav-item">
            <span className="nav-ico"><Icon name={s.i} size={14} /></span>
            <span>{s.l}</span>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-foot">
        <Avatar name={userName} tone="accent" />
        <div className="user-meta">
          <b>{userName}</b>
          <span>{userRole}</span>
        </div>
        <button
          className="btn ghost sm icon"
          onClick={() => router.push('/settings')}
          title="Configuración"
        >
          <Icon name="settings" size={14} />
        </button>
        <button
          className="btn ghost sm icon"
          onClick={signOut}
          title="Cerrar sesión"
        >
          <Icon name="arrow_dn" size={14} />
        </button>
      </div>
    </aside>
  )
}
