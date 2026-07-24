'use client'
import { useEffect } from 'react'
import Sidebar from './Sidebar'

interface AppShellProps {
  userName: string
  userRole: string
  isOwner: boolean
  currentUserId: string
  contactCount: number
  dealCount: number
  taskCount: number
  teamCount: number
  inboxCount: number
  themePreference: string
  densityPreference: string
  currencyPreference: string
  children: React.ReactNode
}

export default function AppShell({
  userName, userRole, isOwner, currentUserId, contactCount, dealCount, taskCount, teamCount, inboxCount,
  themePreference, densityPreference, currencyPreference, children,
}: AppShellProps) {

  useEffect(() => {
    // Sync Supabase preferences → localStorage on every page load
    // This ensures settings persist across domains and devices
    const applyTheme = (t: string) => {
      if (t === 'Oscuro') {
        document.documentElement.setAttribute('data-theme', 'dark')
      } else if (t === 'Claro') {
        document.documentElement.removeAttribute('data-theme')
      } else {
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
        dark
          ? document.documentElement.setAttribute('data-theme', 'dark')
          : document.documentElement.removeAttribute('data-theme')
      }
    }

    const applyDensity = (d: string) => {
      document.documentElement.removeAttribute('data-density')
      if (d === 'Compacta') document.documentElement.setAttribute('data-density', 'compact')
      if (d === 'Cómoda')   document.documentElement.setAttribute('data-density', 'cozy')
    }

    // Always write Supabase values to localStorage so they survive domain changes
    localStorage.setItem('crm-theme',    themePreference)
    localStorage.setItem('crm-density',  densityPreference)
    localStorage.setItem('crm-currency', currencyPreference)

    applyTheme(themePreference)
    applyDensity(densityPreference)
  }, [themePreference, densityPreference, currencyPreference])

  return (
    <>
      <Sidebar
        userName={userName}
        userRole={userRole}
        isOwner={isOwner}
        currentUserId={currentUserId}
        contactCount={contactCount}
        dealCount={dealCount}
        taskCount={taskCount}
        teamCount={teamCount}
        inboxCount={inboxCount}
      />
      <main className="main">
        {children}
      </main>
    </>
  )
}
