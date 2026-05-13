'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  isOwner: boolean
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
    { id: 'dashboard', label: 'Dashboard',          icon: 'dashboard', href: '/dashboard' },
    { id: 'contacts',  label: 'Contactos',          icon: 'contacts',  href: '/contacts',  count: contactCount },
    { id: 'pipeline',  label: 'Pipeline',           icon: 'pipeline',  href: '/pipeline',  count: dealCount },
    { id: 'tasks',     label: 'Tareas',             icon: 'tasks',     href: '/tasks',     count: taskCount },
    { id: 'calendar',  label: 'Calendario',         icon: 'calendar',  href: '/calendar' },
    { id: 'reports',   label: 'Reportes',           icon: 'reports',   href: '/reports' },
    { id: 'inbox',     label: 'Inbox',              icon: 'inbox',     href: '/inbox',     count: inboxCount },
    ...(isOwner ? [{ id: 'team', label: 'Equipo',  icon: 'team',      href: '/team',      count: teamCount }] : []),
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
