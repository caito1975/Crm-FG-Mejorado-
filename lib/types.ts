// Norte CRM — TypeScript types

export type ContactStatus = 'cliente' | 'oportunidad' | 'lead' | 'archivado' | 'enviado' | 'no_enviado' | 'interesado' | 'contactar'
export type TaskPriority  = 'alta' | 'media' | 'baja'
export type ActivityKind  = 'email_in' | 'email_out' | 'call_out' | 'meeting' | 'note' | 'invoice' | 'stage_change'
export type MemberPerm    = 'admin' | 'manager' | 'vendedor' | 'sdr' | 'viewer'
export type MemberStatus  = 'activo' | 'inactivo' | 'invitado'

export interface PipelineStage {
  id: string
  label: string
  color: string
  position: number
  user_id: string
}

export interface Company {
  id: string
  created_at: string
  user_id: string
  name: string
  industry: string | null
  website: string | null
  city: string | null
  country: string | null
  notes: string | null
}

export const RUBROS = [
  'Ecommerce',
  'Concesionaria de Autos',
  'Concesionaria de Motos',
  'Indumentaria',
  'Salud',
  'Tecnologia',
  'Educacion',
  'Muebles - Deco',
  'Turismo',
  'Real State',
  'Otros',
] as const

export type Rubro = typeof RUBROS[number]

export interface Contact {
  id: string
  created_at: string
  user_id: string
  name: string
  company: string | null
  company_id: string | null
  role: string | null
  email: string | null
  phone: string | null
  city: string | null
  status: ContactStatus
  tags: string[]
  rubro: Rubro | null
  website: string | null
  last_touch: string | null
  owner_name: string | null
  value: number
  assigned_to: string | null
}

export interface Deal {
  id: string
  created_at: string
  user_id: string
  title: string
  contact_id: string | null
  stage_id: string
  amount: number
  probability: number
  close_date: string | null
  owner_name: string | null
  position: number
  contact?: Contact
  assigned_to: string | null
}

export interface Task {
  id: string
  created_at: string
  user_id: string
  title: string
  due_label: string | null
  due_date: string | null
  priority: TaskPriority
  done: boolean
  contact_id: string | null
  deal_id: string | null
  task_type: string | null
  contact?: Contact
}

export interface Activity {
  id: string
  created_at: string
  user_id: string
  kind: ActivityKind
  who: string | null
  body: string | null
  contact_id: string | null
  deal_id: string | null
  contact?: Contact
}

export interface TeamMember {
  id: string
  created_at: string
  owner_id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  permission: MemberPerm
  tone: string
  status: MemberStatus
  quota: number
  sold: number
  deals_count: number
  win_rate: number
  region: string | null
  joined_label: string | null
}

export type HistorialTipo = 'ASIGNACION' | 'CAMBIO_ESTADO' | 'NOTA' | 'LLAMADA' | 'EMAIL'

export interface HistorialLead {
  id: string
  created_at: string
  user_id: string
  fecha: string
  nombre: string
  numero: string | null
  tipo: HistorialTipo
  mensaje: string | null
  etapa_anterior: string | null
  etapa_nueva: string | null
  vendedor: string | null
  notas: string | null
  contact_id: string | null
}

export interface InboxMessage {
  id: string
  created_at: string
  user_id: string
  from_name: string | null
  subject: string | null
  preview: string | null
  body: string | null
  sent_label: string | null
  unread: boolean
  starred: boolean
  labels: string[]
}

// Default pipeline stages
export const DEFAULT_STAGES: Omit<PipelineStage, 'user_id'>[] = [
  { id: 'enviado',      label: 'Enviado',         color: 'oklch(68% 0.08 230)',  position: 0 },
  { id: 'contactar',    label: 'Contactar',       color: 'oklch(70% 0.10 200)',  position: 1 },
  { id: 'contactado',   label: 'Contactado',      color: 'oklch(68% 0.12 195)',  position: 2 },
  { id: 'interesado',   label: 'Interesado',      color: 'oklch(65% 0.14 200)',  position: 3 },
  { id: 'reu_inicial',  label: 'Reu. Inicial',    color: 'oklch(65% 0.11 230)',  position: 4 },
  { id: 'seg_reu',      label: 'Seg. Reunión',    color: 'oklch(65% 0.13 260)',  position: 5 },
  { id: 'prop_enviada', label: 'Prop. Enviada',   color: 'oklch(68% 0.14 305)',  position: 6 },
  { id: 'doc_enviada',  label: 'Doc. Enviada',    color: 'oklch(65% 0.13 280)',  position: 7 },
  { id: 'doc_firmada',  label: 'Doc. Firmada',    color: 'oklch(62% 0.14 145)',  position: 8 },
  { id: 'ped_fc',       label: 'Ped. de FC',      color: 'oklch(70% 0.14 75)',   position: 9 },
  { id: 'ganado',       label: 'Ganado-Consumo',  color: 'oklch(58% 0.15 155)',  position: 10 },
  { id: 'perdido',      label: 'Perdido',         color: 'oklch(60% 0.14 25)',   position: 11 },
]

export function getInitials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

export function formatCurrency(value: number): string {
  if (value >= 1000000) return `$ ${(value / 1000000).toFixed(1)}M`
  if (value >= 1000)    return `$ ${(value / 1000).toFixed(0)}k`
  return `$ ${value.toLocaleString('es-AR')}`
}
