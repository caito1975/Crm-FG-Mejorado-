'use client'
import { useState, useEffect } from 'react'
import KanbanBoard from './KanbanBoard'
import type { Deal, PipelineStage, Contact } from '@/lib/types'

interface Props {
  userId: string
  isOwner?: boolean
  vendorAuthId?: string
  stages: PipelineStage[]
  initialDeals: Deal[]
  contacts: Pick<Contact, 'id' | 'name' | 'company'>[]
}

export default function KanbanBoardClient(props: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return <div style={{ flex: 1, minHeight: 0 }} />

  return <KanbanBoard {...props} />
}
