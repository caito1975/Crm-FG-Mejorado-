'use client'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'

interface AppShellProps {
  userName: string
  userRole: string
  isOwner: boolean
  contactCount: number
  dealCount: number
  taskCount: number
  teamCount: number
  inboxCount: number
  children: React.ReactNode
}

export default function AppShell({
  userName, userRole, isOwner, contactCount, dealCount, taskCount, teamCount, inboxCount, children,
}: AppShellProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      {mounted && (
        <Sidebar
          userName={userName}
          userRole={userRole}
          isOwner={isOwner}
          contactCount={contactCount}
          dealCount={dealCount}
          taskCount={taskCount}
          teamCount={teamCount}
          inboxCount={inboxCount}
        />
      )}
      <main className="main">
        {children}
      </main>
    </>
  )
}
