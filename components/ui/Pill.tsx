import type { ContactStatus, TaskPriority } from '@/lib/types'

const STATUS_MAP: Record<ContactStatus, { cls: string; label: string }> = {
  cliente:     { cls: 'success', label: 'Cliente' },
  oportunidad: { cls: 'accent',  label: 'Oportunidad' },
  interesado:  { cls: 'info',    label: 'Interesado' },
  lead:        { cls: '',        label: 'Lead' },
  archivado:   { cls: '',        label: 'Archivado' },
  enviado:     { cls: 'warning', label: 'Enviado' },
  no_enviado:  { cls: 'danger',  label: 'No enviado' },
  enviar_mail: { cls: 'info',    label: 'Enviar mail' },
}

const PRIORITY_MAP: Record<TaskPriority, string> = {
  alta:  'danger',
  media: 'warning',
  baja:  '',
}

export function StatusPill({ status }: { status: ContactStatus }) {
  const m = STATUS_MAP[status] || { cls: '', label: status }
  return (
    <span className={`pill ${m.cls}`}>
      <span className="dot" />
      {m.label}
    </span>
  )
}

export function PriorityPill({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`pill ${PRIORITY_MAP[priority] || ''}`}>
      {priority}
    </span>
  )
}

export function TagPill({ tag }: { tag: string }) {
  return <span className="pill">{tag}</span>
}
