'use client'
import dynamic from 'next/dynamic'
import type { Deal, PipelineStage, Contact } from '@/lib/types'

const KanbanBoard = dynamic(() => import('./KanbanBoard'), {
  ssr: false,
  loading: () => <div style={{ flex: 1, minHeight: 0 }} />,
})

interface Props {
  userId: string
  isOwner?: boolean
  vendorAuthId?: string
  stages: PipelineStage[]
  initialDeals: Deal[]
  contacts: Pick<Contact, 'id' | 'name' | 'company'>[]
}

export default function KanbanBoardClient(props: Props) {
  return <KanbanBoard {...props} />
}
