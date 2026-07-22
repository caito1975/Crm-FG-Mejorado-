'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import Icon from '@/components/ui/Icon'
import Avatar from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/client'
import type { TeamMember, HistorialLead, HistorialTipo, Contact, Deal } from '@/lib/types'
import { formatCurrency } from '@/lib/types'
import * as XLSX from 'xlsx'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────
type Period    = 'hoy' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'año' | 'año_ant' | 'custom'
type MainView  = 'ranking' | 'vendedores' | 'evolucion'
type VendorTab = 'contactos' | 'cobertura' | 'pipeline' | 'detalle' | 'evolucion'

interface Props {
  registros:     HistorialLead[]
  members:       TeamMember[]
  contacts:      Contact[]
  deals:         Deal[]
  isOwner:       boolean
  userId:        string
  currentUserId: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TIPO_STYLE: Record<HistorialTipo, { bg: string; color: string; label: string }> = {
  ASIGNACION:    { bg: 'var(--warning-soft)',  color: 'oklch(48% 0.15 75)',  label: 'Asignación'   },
  CAMBIO_ESTADO: { bg: 'var(--info-soft)',     color: 'var(--info)',          label: 'Cambio etapa' },
  NOTA:          { bg: 'var(--bg-panel)',       color: 'var(--text-muted)',   label: 'Nota'         },
  LLAMADA:       { bg: 'var(--success-soft)',  color: 'var(--success)',       label: 'Llamada'      },
  EMAIL:         { bg: 'var(--accent-soft)',   color: 'var(--accent)',        label: 'Email'        },
  WHATSAPP:      { bg: 'oklch(92% 0.08 145)', color: 'oklch(42% 0.18 145)', label: 'WhatsApp'     },
}

const PERIOD_OPTIONS: { value: Period; label: string; group: 'corto' | 'historico' | 'custom' }[] = [
  { value: 'hoy',       label: 'Hoy',            group: 'corto'    },
  { value: 'semana',    label: 'Semana',          group: 'corto'    },
  { value: 'mes',       label: 'Mes',             group: 'corto'    },
  { value: 'trimestre', label: 'Trimestre',       group: 'historico'},
  { value: 'semestre',  label: 'Semestre',        group: 'historico'},
  { value: 'año',       label: 'Año actual',      group: 'historico'},
  { value: 'año_ant',   label: 'Últ. 12 meses',  group: 'historico'},
  { value: 'custom',    label: 'Rango',           group: 'custom'   },
]

// Stage order for positive/negative change detection
const STAGE_ORDER = ['enviado','contactar','contactado','interesado','reu_inicial','seg_reu','prop_enviada','doc_enviada','doc_firmada','ped_fc','ganado']

type AvatarTone = 'accent' | 'info' | 'success' | 'warning' | 'danger'
const VENDOR_TONES: AvatarTone[] = ['accent', 'success', 'warning', 'info', 'danger']

// ─── Date helpers ─────────────────────────────────────────────────────────────
function startOfDay(d: Date)   { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function startOfWeek(d: Date)  { const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; const m = new Date(d); m.setDate(d.getDate() + diff); return startOfDay(m) }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function startOfYear(d: Date)  { return new Date(d.getFullYear(), 0, 1) }
function daysAgo(n: number)    { const d = new Date(); d.setDate(d.getDate() - n); return startOfDay(d) }
function toInputDate(d: Date)  { return d.toISOString().slice(0, 10) }

function getCutoff(period: Period, now: Date): Date {
  switch (period) {
    case 'hoy':       return startOfDay(now)
    case 'semana':    return startOfWeek(now)
    case 'mes':       return startOfMonth(now)
    case 'trimestre': return daysAgo(90)
    case 'semestre':  return daysAgo(180)
    case 'año':       return startOfYear(now)
    case 'año_ant':   return daysAgo(365)
    default:          return startOfDay(now)
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtDateShort(d: Date) {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Calculation helpers ──────────────────────────────────────────────────────
interface KPIs {
  total: number; contactos: number; llamadas: number
  emails: number; whatsapps: number; notas: number; cambios: number; asignaciones: number
}
function calcKPIs(regs: HistorialLead[]): KPIs {
  return {
    total:        regs.length,
    contactos:    new Set(regs.map(r => r.nombre)).size,
    llamadas:     regs.filter(r => r.tipo === 'LLAMADA').length,
    emails:       regs.filter(r => r.tipo === 'EMAIL').length,
    whatsapps:    regs.filter(r => r.tipo === 'WHATSAPP').length,
    notas:        regs.filter(r => r.tipo === 'NOTA').length,
    cambios:      regs.filter(r => r.tipo === 'CAMBIO_ESTADO').length,
    asignaciones: regs.filter(r => r.tipo === 'ASIGNACION').length,
  }
}

function calcDiasActivos(regs: HistorialLead[]): number {
  return new Set(regs.map(r => r.fecha.slice(0, 10))).size
}

function calcFollowUpRate(regs: HistorialLead[]): number {
  const counts = new Map<string, number>()
  regs.forEach(r => counts.set(r.nombre, (counts.get(r.nombre) ?? 0) + 1))
  const total = counts.size
  if (!total) return 0
  const repeated = Array.from(counts.values()).filter(c => c > 1).length
  return Math.round((repeated / total) * 100)
}

function calcCambiosPositivos(regs: HistorialLead[]): number {
  return regs.filter(r => {
    if (r.tipo !== 'CAMBIO_ESTADO') return false
    const fromIdx = STAGE_ORDER.indexOf(r.etapa_anterior ?? '')
    const toIdx   = STAGE_ORDER.indexOf(r.etapa_nueva   ?? '')
    return fromIdx >= 0 && toIdx > fromIdx
  }).length
}

function calcTasaCierre(regs: HistorialLead[]): { ganados: number; perdidos: number; tasa: number } {
  const ganados  = regs.filter(r => r.tipo === 'CAMBIO_ESTADO' && r.etapa_nueva === 'ganado').length
  const perdidos = regs.filter(r => r.tipo === 'CAMBIO_ESTADO' && r.etapa_nueva === 'perdido').length
  const tasa     = ganados + perdidos > 0 ? Math.round((ganados / (ganados + perdidos)) * 100) : 0
  return { ganados, perdidos, tasa }
}

function calcVelocidad(regs: HistorialLead[]): number | null {
  const byContact = new Map<string, HistorialLead[]>()
  regs.forEach(r => {
    if (!r.contact_id) return
    if (!byContact.has(r.contact_id)) byContact.set(r.contact_id, [])
    byContact.get(r.contact_id)!.push(r)
  })
  const days: number[] = []
  byContact.forEach(recs => {
    const asig = recs.find(r => r.tipo === 'ASIGNACION')
    if (!asig) return
    const first = recs
      .filter(r => r.tipo !== 'ASIGNACION' && r.fecha > asig.fecha)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))[0]
    if (!first) return
    days.push((new Date(first.fecha).getTime() - new Date(asig.fecha).getTime()) / 86400000)
  })
  if (!days.length) return null
  return Math.round(days.reduce((a, b) => a + b, 0) / days.length * 10) / 10
}

function calcTasaContactacion(vendorName: string, contacts: Contact[], periodRegs: HistorialLead[]): { cartera: number; contactados: number; tasa: number } {
  const cartera    = contacts.filter(c => c.owner_name === vendorName).length
  if (!cartera) return { cartera: 0, contactados: 0, tasa: 0 }
  const nombres    = new Set(periodRegs.map(r => r.nombre))
  const contactados = contacts.filter(c => c.owner_name === vendorName && nombres.has(c.name)).length
  return { cartera, contactados, tasa: Math.round((contactados / cartera) * 100) }
}

function calcSinGestion(vendorName: string, contacts: Contact[], periodRegs: HistorialLead[]): Contact[] {
  const nombres = new Set(periodRegs.map(r => r.nombre))
  return contacts.filter(c => c.owner_name === vendorName && !nombres.has(c.name))
}

function calcContactosNuevos(vendorName: string, contacts: Contact[], periodRegs: HistorialLead[], cutoff: Date): number {
  const nombres    = new Set(periodRegs.map(r => r.nombre))
  return contacts.filter(c => c.owner_name === vendorName && new Date(c.created_at) >= cutoff && nombres.has(c.name)).length
}

function calcValorPipeline(vendorName: string, deals: Deal[]): number {
  return deals.filter(d => d.owner_name === vendorName && d.stage_id !== 'ganado' && d.stage_id !== 'perdido').reduce((s, d) => s + d.amount, 0)
}

function calcContactFreq(regs: HistorialLead[]) {
  const map = new Map<string, { nombre: string; numero: string | null; count: number; lastDate: string; tipos: Set<HistorialTipo>; interactions: HistorialLead[] }>()
  for (const r of regs) {
    if (!map.has(r.nombre)) map.set(r.nombre, { nombre: r.nombre, numero: r.numero, count: 0, lastDate: r.fecha, tipos: new Set(), interactions: [] })
    const e = map.get(r.nombre)!
    e.count++; e.interactions.push(r)
    if (r.fecha > e.lastDate) { e.lastDate = r.fecha; e.numero = r.numero }
    e.tipos.add(r.tipo)
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

function calcEvolution(regs: HistorialLead[], cutoff: Date, ceiling: Date) {
  const end = new Date(Math.min(ceiling.getTime(), new Date().getTime()))
  const diffDays = Math.ceil((end.getTime() - cutoff.getTime()) / 86400000)
  const map = new Map<string, { llamada: number; email: number; whatsapp: number; nota: number; otro: number }>()
  const d = new Date(cutoff)
  while (d <= end) {
    map.set(d.toISOString().slice(0, 10), { llamada: 0, email: 0, whatsapp: 0, nota: 0, otro: 0 })
    d.setDate(d.getDate() + 1)
  }
  regs.forEach(r => {
    const key = r.fecha.slice(0, 10)
    if (!map.has(key)) return
    const e = map.get(key)!
    if      (r.tipo === 'LLAMADA')   e.llamada++
    else if (r.tipo === 'EMAIL')     e.email++
    else if (r.tipo === 'WHATSAPP')  e.whatsapp++
    else if (r.tipo === 'NOTA')      e.nota++
    else                             e.otro++
  })
  const interval = diffDays <= 14 ? 1 : diffDays <= 31 ? 2 : diffDays <= 90 ? 7 : 14
  let i = 0
  return Array.from(map.entries()).map(([date, c]) => {
    const label = ++i % interval === 0 || i === 1
      ? new Date(date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
      : ''
    return { label, date, ...c, total: c.llamada + c.email + c.whatsapp + c.nota + c.otro }
  })
}

function semaphoreColor(value: number, allValues: number[], higherIsBetter = true): string {
  if (allValues.length <= 1) return 'var(--text-muted)'
  const sorted = [...allValues].sort((a, b) => higherIsBetter ? b - a : a - b)
  const pct = sorted.indexOf(value) / (sorted.length - 1)
  return pct < 0.34 ? 'var(--success)' : pct < 0.67 ? 'oklch(65% 0.15 75)' : 'var(--danger)'
}

function prevPeriodBounds(cutoff: Date, ceiling: Date): { from: Date; to: Date } {
  const duration = ceiling.getTime() - cutoff.getTime()
  const to   = new Date(cutoff.getTime() - 1)
  const from = new Date(to.getTime() - duration)
  return { from, to }
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────
function KpiChip({ label, value, color, sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 16px', minWidth: 78, gap: 2 }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text)', lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 10, color: color || 'var(--accent)', fontWeight: 600 }}>{sub}</span>}
      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

function TrendBadge({ cur, prev }: { cur: number; prev: number }) {
  if (cur === 0 && prev === 0) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
  const diff = cur - prev
  const pct  = prev > 0 ? Math.round((diff / prev) * 100) : 100
  return (
    <span style={{ fontSize: 11, color: diff >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
      {diff >= 0 ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  )
}

function SemBadge({ value, color }: { value: number | string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

// ─── Evolution chart ──────────────────────────────────────────────────────────
function EvolucionChart({ regs, cutoff, ceiling, height = 110 }: { regs: HistorialLead[]; cutoff: Date; ceiling: Date; height?: number }) {
  const data = useMemo(() => calcEvolution(regs, cutoff, ceiling), [regs, cutoff, ceiling])
  if (data.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Sin datos en este período</div>
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{d?.date}</div>
        {d?.llamada   > 0 && <div style={{ color: 'var(--success)'           }}>📞 Llamadas: {d.llamada}</div>}
        {d?.email     > 0 && <div style={{ color: 'var(--accent)'             }}>✉️ Emails: {d.email}</div>}
        {d?.whatsapp  > 0 && <div style={{ color: 'oklch(42% 0.18 145)'      }}>💬 WhatsApp: {d.whatsapp}</div>}
        {d?.nota      > 0 && <div style={{ color: 'var(--text-muted)'         }}>📝 Notas: {d.nota}</div>}
        {d?.otro      > 0 && <div style={{ color: 'var(--info)'               }}>🔄 Otros: {d.otro}</div>}
        <div style={{ fontWeight: 600, marginTop: 4 }}>Total: {d?.total}</div>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={Math.max(4, Math.min(18, 600 / data.length))}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-inset)' }} />
        <Bar dataKey="llamada"  stackId="a" fill="var(--success)"         radius={[0,0,0,0]} name="Llamadas"  />
        <Bar dataKey="email"    stackId="a" fill="var(--accent)"           radius={[0,0,0,0]} name="Emails"    />
        <Bar dataKey="whatsapp" stackId="a" fill="oklch(52% 0.18 145)"    radius={[0,0,0,0]} name="WhatsApp"  />
        <Bar dataKey="nota"     stackId="a" fill="var(--text-muted)"       radius={[0,0,0,0]} name="Notas"     />
        <Bar dataKey="otro"     stackId="a" fill="var(--info)"             radius={[3,3,0,0]} name="Otros"     />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Ranking table ────────────────────────────────────────────────────────────
interface VStats {
  vendorName: string; regs: HistorialLead[]
  kpis: KPIs; diasActivos: number; followUpRate: number
  cambiosPos: number; cierre: { ganados: number; perdidos: number; tasa: number }
  velocidad: number | null; tasa: { cartera: number; contactados: number; tasa: number }
  sinGestion: number; nuevosGest: number; valorPipeline: number
  prevKpis: KPIs; prevDias: number; prevFollowUp: number
}

function RankingTable({ stats, period }: { stats: VStats[]; period: string }) {
  const all = (key: keyof VStats) => stats.map(s => Number(s[key]) || 0)
  const th: React.CSSProperties = { padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', background: 'var(--bg-inset)' }
  const td: React.CSSProperties = { padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', fontSize: 13 }

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left', minWidth: 140 }}>Vendedor</th>
            <th style={th}>Acciones<br/><span style={{ fontWeight: 400, fontSize: 10 }}>vs anterior</span></th>
            <th style={th}>Días activos</th>
            <th style={th}>Follow-up %</th>
            <th style={th}>Tasa cont. %</th>
            <th style={th}>Sin gestión</th>
            <th style={th}>Llamadas</th>
            <th style={th}>WhatsApp</th>
            <th style={th}>Emails</th>
            <th style={th}>Cambios ↑</th>
            <th style={th}>Ganados</th>
            <th style={th}>Cierre %</th>
            <th style={th}>Pipeline</th>
            <th style={th}>Veloc. días</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => {
            const tone = VENDOR_TONES[i % VENDOR_TONES.length]
            return (
              <tr key={s.vendorName} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-inset)' }}>
                <td style={{ ...td, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={s.vendorName} tone={tone} size="sm" />
                    <span style={{ fontWeight: 500 }}>{s.vendorName}</span>
                  </div>
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <SemBadge value={s.kpis.total} color={semaphoreColor(s.kpis.total, all('kpis'))} />
                    <TrendBadge cur={s.kpis.total} prev={s.prevKpis.total} />
                  </div>
                </td>
                <td style={td}>
                  <SemBadge value={s.diasActivos} color={semaphoreColor(s.diasActivos, all('diasActivos'))} />
                </td>
                <td style={td}>
                  <SemBadge value={`${s.followUpRate}%`} color={semaphoreColor(s.followUpRate, all('followUpRate'))} />
                </td>
                <td style={td}>
                  <SemBadge value={`${s.tasa.tasa}%`} color={semaphoreColor(s.tasa.tasa, stats.map(x => x.tasa.tasa))} />
                </td>
                <td style={td}>
                  <SemBadge value={s.sinGestion} color={semaphoreColor(s.sinGestion, all('sinGestion'), false)} />
                </td>
                <td style={{ ...td, color: 'var(--success)',          fontWeight: 500 }}>{s.kpis.llamadas}</td>
                <td style={{ ...td, color: 'oklch(42% 0.18 145)',   fontWeight: 500 }}>{s.kpis.whatsapps}</td>
                <td style={{ ...td, color: 'var(--accent)',          fontWeight: 500 }}>{s.kpis.emails}</td>
                <td style={td}>{s.cambiosPos}</td>
                <td style={{ ...td, color: 'var(--success)', fontWeight: 600 }}>{s.cierre.ganados}</td>
                <td style={td}>
                  <SemBadge value={`${s.cierre.tasa}%`} color={semaphoreColor(s.cierre.tasa, stats.map(x => x.cierre.tasa))} />
                </td>
                <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.valorPipeline > 0 ? formatCurrency(s.valorPipeline) : '—'}</td>
                <td style={td}>
                  {s.velocidad !== null
                    ? <SemBadge value={`${s.velocidad}d`} color={semaphoreColor(s.velocidad, stats.filter(x => x.velocidad !== null).map(x => x.velocidad as number), false)} />
                    : <span style={{ color: 'var(--text-muted)' }}>—</span>
                  }
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Vendor section ───────────────────────────────────────────────────────────
function VendorSection({ stats, contacts, deals, cutoff, ceiling, allStats, defaultOpen }: {
  stats: VStats; contacts: Contact[]; deals: Deal[]; cutoff: Date; ceiling: Date; allStats: VStats[]; defaultOpen: boolean
}) {
  const [open, setOpen]             = useState(defaultOpen)
  const [tab, setTab]               = useState<VendorTab>('contactos')
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [search, setSearch]         = useState('')

  const { vendorName, regs, kpis, diasActivos, followUpRate, cambiosPos, cierre, velocidad, tasa, sinGestion: sinGestionCount, nuevosGest, valorPipeline, prevKpis } = stats
  const allTotal   = allStats.map(s => s.kpis.total)
  const allDias    = allStats.map(s => s.diasActivos)
  const allFup     = allStats.map(s => s.followUpRate)
  const allTasa    = allStats.map(s => s.tasa.tasa)
  const sinGestion = calcSinGestion(vendorName, contacts, regs)

  const freq = useMemo(() => {
    const q = search.toLowerCase()
    const f = calcContactFreq(regs)
    return q ? f.filter(c => c.nombre.toLowerCase().includes(q) || (c.numero ?? '').includes(q)) : f
  }, [regs, search])

  const filteredRegs = useMemo(() => {
    const q = search.toLowerCase()
    return q ? regs.filter(r => r.nombre.toLowerCase().includes(q) || (r.mensaje ?? '').toLowerCase().includes(q)) : regs
  }, [regs, search])

  const chipStyle: React.CSSProperties = { padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }
  const maxFreq = freq[0]?.count ?? 1

  const tabBtn = (v: VendorTab, label: string) => (
    <button key={v} onClick={() => setTab(v)} style={{ padding: '5px 13px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: tab === v ? 'var(--bg-panel)' : 'transparent', color: tab === v ? 'var(--text)' : 'var(--text-muted)', fontWeight: tab === v ? 600 : 400, boxShadow: tab === v ? '0 1px 3px rgba(0,0,0,.15)' : 'none' }}>
      {label}
    </button>
  )

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', borderBottom: open ? '1px solid var(--border)' : 'none', background: 'var(--bg-panel)' }} onClick={() => setOpen(o => !o)}>
        <Avatar name={vendorName} tone={VENDOR_TONES[allStats.findIndex(s => s.vendorName === vendorName) % VENDOR_TONES.length]} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{vendorName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {kpis.total} acciones · {kpis.contactos} contactos · {diasActivos} días activos · {tasa.tasa}% tasa contactación
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {kpis.llamadas  > 0 && <span style={{ ...chipStyle, background: 'var(--success-soft)',    color: 'var(--success)'          }}>📞 {kpis.llamadas}</span>}
          {kpis.emails    > 0 && <span style={{ ...chipStyle, background: 'var(--accent-soft)',     color: 'var(--accent)'           }}>✉️ {kpis.emails}</span>}
          {kpis.whatsapps > 0 && <span style={{ ...chipStyle, background: 'oklch(92% 0.08 145)', color: 'oklch(42% 0.18 145)'    }}>💬 {kpis.whatsapps}</span>}
          {sinGestionCount > 0 && <span style={{ ...chipStyle, background: 'var(--danger-soft)',    color: 'var(--danger)'           }}>⚠️ {sinGestionCount} sin gestión</span>}
          {cierre.ganados  > 0 && <span style={{ ...chipStyle, background: 'var(--success-soft)',   color: 'var(--success)'          }}>🏆 {cierre.ganados} ganados</span>}
        </div>
        <Icon name="chev_down" size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </div>

      {open && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Ronda 1: Actividad KPIs ── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 8 }}>Actividad</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <KpiChip label="Total acciones"   value={kpis.total}      color={semaphoreColor(kpis.total, allTotal)}     sub={kpis.total !== prevKpis.total ? (kpis.total > prevKpis.total ? `↑ vs ant.` : `↓ vs ant.`) : undefined} />
              <KpiChip label="Días activos"      value={diasActivos}     color={semaphoreColor(diasActivos, allDias)} />
              <KpiChip label="Follow-up %"       value={`${followUpRate}%`} color={semaphoreColor(followUpRate, allFup)} />
              <KpiChip label="Llamadas"          value={kpis.llamadas}   color="var(--success)" />
              <KpiChip label="Emails"            value={kpis.emails}     color="var(--accent)" />
              <KpiChip label="WhatsApp"          value={kpis.whatsapps}  color="oklch(42% 0.18 145)" />
              <KpiChip label="Notas"             value={kpis.notas}      color="var(--text-muted)" />
              <KpiChip label="Cambios ↑ etapa"   value={cambiosPos}      color="var(--info)" />
              <KpiChip label="Asignaciones"      value={kpis.asignaciones} color="oklch(48% 0.15 75)" />
            </div>
          </div>

          {/* ── Ronda 2: Cobertura KPIs ── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 8 }}>Cobertura de cartera</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <KpiChip label="Cartera asignada"  value={tasa.cartera}    color="var(--text)" />
              <KpiChip label="Contactados"        value={tasa.contactados} color="var(--accent)" />
              <KpiChip label="Tasa contactación" value={`${tasa.tasa}%`} color={semaphoreColor(tasa.tasa, allTasa)} />
              <KpiChip label="Sin gestión"        value={sinGestionCount} color={sinGestionCount > 0 ? 'var(--danger)' : 'var(--success)'} />
              <KpiChip label="Nuevos gestionados" value={nuevosGest}      color="var(--info)" />
            </div>
          </div>

          {/* ── Ronda 3: Pipeline KPIs ── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 8 }}>Pipeline y conversión</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <KpiChip label="Ganados"            value={cierre.ganados}  color="var(--success)" />
              <KpiChip label="Perdidos"           value={cierre.perdidos} color="var(--danger)" />
              <KpiChip label="Tasa de cierre"     value={`${cierre.tasa}%`} color={cierre.tasa >= 50 ? 'var(--success)' : cierre.tasa > 0 ? 'oklch(65% 0.15 75)' : 'var(--text-muted)'} />
              <KpiChip label="Pipeline activo"    value={valorPipeline > 0 ? formatCurrency(valorPipeline) : '—'} color="var(--accent)" />
              <KpiChip label="Vel. 1er contacto"  value={velocidad !== null ? `${velocidad}d` : '—'} color={velocidad !== null ? (velocidad <= 1 ? 'var(--success)' : velocidad <= 3 ? 'oklch(65% 0.15 75)' : 'var(--danger)') : 'var(--text-muted)'} />
            </div>
          </div>

          {/* ── vs Período anterior ── */}
          <div style={{ background: 'var(--bg-inset)', borderRadius: 'var(--r-md)', padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>VS. PERÍODO ANTERIOR</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
              {[
                ['Acciones',   kpis.total,       prevKpis.total],
                ['Llamadas',   kpis.llamadas,    prevKpis.llamadas],
                ['Emails',     kpis.emails,      prevKpis.emails],
                ['WhatsApp',   kpis.whatsapps,   prevKpis.whatsapps],
                ['Notas',      kpis.notas,       prevKpis.notas],
                ['Contactos',  kpis.contactos,   prevKpis.contactos],
              ].map(([label, cur, prev]) => (
                <div key={label as string} style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</span>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{cur}</span>
                  <TrendBadge cur={cur as number} prev={prev as number} />
                </div>
              ))}
            </div>
          </div>

          {/* ── Views ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-inset)', borderRadius: 8, padding: 3 }}>
              {tabBtn('contactos', 'Contactos')}
              {tabBtn('cobertura', 'Sin gestión')}
              {tabBtn('pipeline',  'Pipeline')}
              {tabBtn('evolucion', 'Evolución')}
              {tabBtn('detalle',   'Detalle')}
            </div>
            {tab !== 'evolucion' && (
              <input className="input" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 180, fontSize: 12 }} />
            )}
          </div>

          {/* ── Tab: Contactos ── */}
          {tab === 'contactos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {freq.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>Sin registros</div>}
              {freq.map(cf => {
                const isExp = expanded === cf.nombre
                const pct   = Math.round((cf.count / maxFreq) * 100)
                const color = cf.count >= 4 ? 'var(--success)' : cf.count >= 2 ? 'var(--accent)' : 'var(--text-muted)'
                return (
                  <div key={cf.nombre} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: isExp ? 'var(--bg-inset)' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer' }} onClick={() => setExpanded(isExp ? null : cf.nombre)}>
                      <div style={{ width: 70, flexShrink: 0 }}>
                        <div style={{ height: 5, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4 }} />
                        </div>
                      </div>
                      <span style={{ minWidth: 24, fontWeight: 700, fontSize: 14, color }}>{cf.count}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{cf.nombre}</div>
                        {cf.numero && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{cf.numero}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {Array.from(cf.tipos).map(t => { const s = TIPO_STYLE[t]; return <span key={t} style={{ background: s.bg, color: s.color, padding: '1px 6px', borderRadius: 20, fontSize: 10, fontWeight: 500 }}>{s.label}</span> })}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{fmtDate(cf.lastDate)}</span>
                      <Icon name="chev_down" size={12} style={{ transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                    </div>
                    {isExp && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {cf.interactions.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((r, i) => {
                          const s = TIPO_STYLE[r.tipo]
                          return (
                            <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                              <span style={{ color: 'var(--text-muted)', minWidth: 18, textAlign: 'right' }}>{i + 1}.</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDate(r.fecha)}</span>
                              <span style={{ background: s.bg, color: s.color, padding: '1px 6px', borderRadius: 20, fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</span>
                              {r.etapa_anterior && r.etapa_nueva && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.etapa_anterior} → <strong style={{ color: 'var(--text)' }}>{r.etapa_nueva}</strong></span>}
                              {r.mensaje && <span style={{ color: 'var(--text)', flex: 1 }}>{r.mensaje}</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Tab: Cobertura / Sin gestión ── */}
          {tab === 'cobertura' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sinGestion.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--success)' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>✓</div>
                  <div style={{ fontWeight: 500 }}>Todos los contactos asignados fueron gestionados</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {sinGestion.length} contactos asignados sin ninguna acción en este período
                  </div>
                  {sinGestion.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase())).map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--danger-soft)' }}>
                      <span style={{ fontSize: 13 }}>⚠️</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {c.status} · {c.last_touch ? `Último contacto: ${fmtDate(c.last_touch)}` : 'Sin actividad registrada'}
                        </div>
                      </div>
                      {c.phone && <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{c.phone}</span>}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Tab: Pipeline ── */}
          {tab === 'pipeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deals.filter(d => d.owner_name === vendorName && d.stage_id !== 'ganado' && d.stage_id !== 'perdido').length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Sin deals activos asignados</div>
              ) : (
                deals.filter(d => d.owner_name === vendorName && d.stage_id !== 'ganado' && d.stage_id !== 'perdido')
                  .sort((a, b) => b.amount - a.amount)
                  .map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{d.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{d.stage_id} · {d.probability}% prob.</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>{formatCurrency(d.amount)}</span>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* ── Tab: Evolución diaria ── */}
          {tab === 'evolucion' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--success)',          display: 'inline-block' }} /> Llamadas</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)',            display: 'inline-block' }} /> Emails</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'oklch(52% 0.18 145)',     display: 'inline-block' }} /> WhatsApp</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--text-muted)',        display: 'inline-block' }} /> Notas</span>
              </div>
              <EvolucionChart regs={regs} cutoff={cutoff} ceiling={ceiling} height={130} />
            </div>
          )}

          {/* ── Tab: Detalle cronológico ── */}
          {tab === 'detalle' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Fecha</th>
                    <th>Contacto</th>
                    <th style={{ width: 90 }}>Teléfono</th>
                    <th style={{ width: 100 }}>Tipo</th>
                    <th>Acción / Mensaje</th>
                    <th style={{ width: 150 }}>Cambio de etapa</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegs.map(r => {
                    const s = TIPO_STYLE[r.tipo]
                    return (
                      <tr key={r.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{fmtDate(r.fecha)}</td>
                        <td style={{ fontWeight: 500 }}>{r.nombre}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{r.numero ?? '—'}</td>
                        <td><span style={{ background: s.bg, color: s.color, padding: '2px 7px', borderRadius: 20, fontSize: 10.5, fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</span></td>
                        <td style={{ fontSize: 12.5 }}>{r.mensaje ?? ''}</td>
                        <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {r.etapa_anterior && r.etapa_nueva ? <>{r.etapa_anterior} → <strong style={{ color: 'var(--text)' }}>{r.etapa_nueva}</strong></> : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredRegs.length === 0 && <tr><td colSpan={6}><div className="empty"><h4>Sin registros</h4></div></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function GestionClient({ registros: init, members, contacts, deals, isOwner, userId, currentUserId }: Props) {
  const [period, setPeriod]         = useState<Period>('hoy')
  const [mainView, setMainView]     = useState<MainView>(isOwner ? 'ranking' : 'vendedores')
  const [selectedVendor, setVendor] = useState('todos')
  const [allData, setAllData]       = useState<HistorialLead[]>(init)
  const [loading, setLoading]       = useState(false)
  const today = new Date()
  const [customFrom, setCustomFrom] = useState(toInputDate(startOfMonth(today)))
  const [customTo,   setCustomTo]   = useState(toInputDate(today))

  const supabase      = createClient()
  const serverCutoff  = useMemo(() => daysAgo(400), [])

  const fetchRange = useCallback(async (from: Date, to: Date) => {
    if (from >= serverCutoff) return
    setLoading(true)
    try {
      const toISO   = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59).toISOString()
      const fromISO = from.toISOString()
      let data: HistorialLead[] = []
      if (isOwner) {
        const { data: hist } = await supabase.from('historial_leads').select('*').eq('user_id', userId).gte('fecha', fromISO).lte('fecha', toISO).order('fecha', { ascending: false })
        data = (hist as HistorialLead[]) ?? []
      } else {
        const ids = contacts.map(c => c.id)
        if (ids.length) {
          const { data: hist } = await supabase.from('historial_leads').select('*').eq('user_id', userId).in('contact_id', ids).gte('fecha', fromISO).lte('fecha', toISO).order('fecha', { ascending: false })
          data = (hist as HistorialLead[]) ?? []
        }
      }
      const merged = [...data]
      const seen = new Set(data.map(r => r.id))
      init.forEach(r => { if (!seen.has(r.id)) merged.push(r) })
      setAllData(merged)
    } finally { setLoading(false) }
  }, [userId, isOwner, serverCutoff, supabase, init, contacts])

  useEffect(() => {
    if (period !== 'custom') return
    const from = new Date(customFrom)
    if (from < serverCutoff) fetchRange(from, new Date(customTo))
  }, [period, customFrom, customTo, fetchRange, serverCutoff])

  const now = useMemo(() => new Date(), [])

  const { cutoff, ceiling } = useMemo(() => {
    if (period === 'custom') {
      return { cutoff: new Date(customFrom), ceiling: new Date(new Date(customTo).setHours(23, 59, 59)) }
    }
    return { cutoff: getCutoff(period, now), ceiling: new Date(8640000000000000) }
  }, [period, customFrom, customTo, now])

  const periodRegs = useMemo(() => allData.filter(r => { const d = new Date(r.fecha); return d >= cutoff && d <= ceiling }), [allData, cutoff, ceiling])

  const { prevCutoff, prevCeiling } = useMemo(() => {
    const b = prevPeriodBounds(cutoff, ceiling)
    return { prevCutoff: b.from, prevCeiling: b.to }
  }, [cutoff, ceiling])

  const prevRegs = useMemo(() => allData.filter(r => { const d = new Date(r.fecha); return d >= prevCutoff && d <= prevCeiling }), [allData, prevCutoff, prevCeiling])

  const allVendors = useMemo(() => {
    if (members.length > 0) return members.map(m => m.name)
    const s = new Set<string>(); allData.forEach(r => { if (r.vendedor) s.add(r.vendedor) }); return Array.from(s).sort()
  }, [allData, members])

  const filtered = useMemo(() => selectedVendor === 'todos' ? periodRegs : periodRegs.filter(r => r.vendedor === selectedVendor), [periodRegs, selectedVendor])
  const prevFiltered = useMemo(() => selectedVendor === 'todos' ? prevRegs : prevRegs.filter(r => r.vendedor === selectedVendor), [prevRegs, selectedVendor])

  const byVendor = useMemo(() => {
    const map = new Map<string, HistorialLead[]>()
    const list = selectedVendor === 'todos' ? allVendors : [selectedVendor]
    list.forEach(v => map.set(v, []))
    filtered.forEach(r => { const v = r.vendedor || '(Sin asignar)'; if (!map.has(v)) map.set(v, []); map.get(v)!.push(r) })
    return map
  }, [filtered, allVendors, selectedVendor])

  const vendorStats: VStats[] = useMemo(() => Array.from(byVendor.entries()).map(([vendorName, regs]) => {
    const prev = selectedVendor === 'todos' ? prevRegs.filter(r => r.vendedor === vendorName) : prevFiltered
    return {
      vendorName, regs,
      kpis:          calcKPIs(regs),
      diasActivos:   calcDiasActivos(regs),
      followUpRate:  calcFollowUpRate(regs),
      cambiosPos:    calcCambiosPositivos(regs),
      cierre:        calcTasaCierre(regs),
      velocidad:     calcVelocidad(regs),
      tasa:          calcTasaContactacion(vendorName, contacts, regs),
      sinGestion:    calcSinGestion(vendorName, contacts, regs).length,
      nuevosGest:    calcContactosNuevos(vendorName, contacts, regs, cutoff),
      valorPipeline: calcValorPipeline(vendorName, deals),
      prevKpis:      calcKPIs(prev),
      prevDias:      calcDiasActivos(prev),
      prevFollowUp:  calcFollowUpRate(prev),
    }
  }), [byVendor, prevRegs, prevFiltered, contacts, deals, cutoff, selectedVendor])

  const globalKPIs  = useMemo(() => calcKPIs(filtered), [filtered])
  const periodLabel = useMemo(() => {
    if (period === 'custom') return `${fmtDateShort(new Date(customFrom))} → ${fmtDateShort(new Date(customTo))}`
    const c = getCutoff(period, now)
    const labels: Record<Period, string> = {
      hoy:       `Hoy — ${now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}`,
      semana:    `Esta semana (desde el ${fmtDateShort(c)})`,
      mes:       `Este mes — ${now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`,
      trimestre: `Últimos 3 meses (desde el ${fmtDateShort(c)})`,
      semestre:  `Últimos 6 meses (desde el ${fmtDateShort(c)})`,
      año:       `Año ${now.getFullYear()}`,
      año_ant:   `Últimos 12 meses`,
      custom:    '',
    }
    return labels[period]
  }, [period, customFrom, customTo, now])

  function exportExcel() {
    const wb = XLSX.utils.book_new()
    const resumen = vendorStats.map(s => ({
      Vendedor: s.vendorName, 'Total acciones': s.kpis.total, 'Días activos': s.diasActivos,
      'Follow-up %': s.followUpRate, 'Tasa contactación %': s.tasa.tasa, 'Cartera asignada': s.tasa.cartera,
      'Sin gestión': s.sinGestion, 'Nuevos gestionados': s.nuevosGest, Llamadas: s.kpis.llamadas,
      WhatsApp: s.kpis.whatsapps, Emails: s.kpis.emails, Notas: s.kpis.notas, 'Cambios ↑ etapa': s.cambiosPos,
      Ganados: s.cierre.ganados, Perdidos: s.cierre.perdidos, 'Tasa cierre %': s.cierre.tasa,
      'Pipeline activo': s.valorPipeline, 'Vel. primer contacto (días)': s.velocidad ?? '',
      'Acciones período ant.': s.prevKpis.total,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen vendedores')

    const detalle = filtered.map(r => ({
      Fecha: r.fecha ? new Date(r.fecha).toLocaleString('es-AR', { hour12: false }) : '', Vendedor: r.vendedor ?? '',
      Contacto: r.nombre, Teléfono: r.numero ?? '', Tipo: TIPO_STYLE[r.tipo]?.label ?? r.tipo,
      'Acción / Mensaje': r.mensaje ?? '', 'Etapa anterior': r.etapa_anterior ?? '', 'Etapa nueva': r.etapa_nueva ?? '', Notas: r.notas ?? '',
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'Detalle cronológico')

    const freqRows: object[] = []
    byVendor.forEach((regs, vn) => {
      calcContactFreq(regs).forEach(cf => freqRows.push({ Vendedor: vn, Contacto: cf.nombre, Teléfono: cf.numero ?? '', 'Veces gestionado': cf.count, 'Último contacto': new Date(cf.lastDate).toLocaleString('es-AR', { hour12: false }), 'Tipos': Array.from(cf.tipos).map(t => TIPO_STYLE[t]?.label ?? t).join(', ') }))
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(freqRows), 'Frecuencia contactos')

    const sinGest: object[] = []
    vendorStats.forEach(s => { calcSinGestion(s.vendorName, contacts, s.regs).forEach(c => sinGest.push({ Vendedor: s.vendorName, Contacto: c.name, Teléfono: c.phone ?? '', Estado: c.status, 'Último contacto': c.last_touch ? new Date(c.last_touch).toLocaleString('es-AR', { hour12: false }) : '' })) })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sinGest), 'Sin gestión')

    const slug = period === 'custom' ? `${customFrom}_${customTo}` : period.replace('_', '-')
    XLSX.writeFile(wb, `gestion_vendedores_${slug}_${now.toISOString().slice(0, 10)}.xlsx`)
  }

  const PVBTN = (v: MainView, label: string) => (
    <button key={v} onClick={() => setMainView(v)} style={{ padding: '6px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: mainView === v ? 'var(--accent)' : 'transparent', color: mainView === v ? '#fff' : 'var(--text-muted)', fontWeight: mainView === v ? 600 : 400 }}>
      {label}
    </button>
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="reports" size={20} />
            Gestión de Vendedores
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            {loading ? '⏳ Cargando datos históricos…' : `Actividad comercial — ${periodLabel}`}
          </p>
        </div>
      </div>

      {/* Tracking start notice */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'var(--info-soft)', border: '1px solid var(--info)', borderRadius: 'var(--r-md)', fontSize: 12.5, color: 'var(--info)', marginBottom: 4 }}>
        <span style={{ fontSize: 16, lineHeight: 1.3, flexShrink: 0 }}>ℹ️</span>
        <span>
          <strong>Seguimiento iniciado el 22/07/2026.</strong>{' '}
          Llamadas, emails, WhatsApp y notas se registran automáticamente a partir de esta fecha.
          Los períodos anteriores no tienen datos.
        </span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Main view tabs */}
          {isOwner && (
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-inset)', borderRadius: 'var(--r-md)', padding: 3, border: '1px solid var(--border)' }}>
              {PVBTN('ranking',   '📊 Ranking')}
              {PVBTN('vendedores','👤 Por Vendedor')}
              {PVBTN('evolucion', '📈 Evolución')}
            </div>
          )}
          {/* Period: short */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-inset)', borderRadius: 'var(--r-md)', padding: 3, border: '1px solid var(--border)' }}>
            {PERIOD_OPTIONS.filter(o => o.group === 'corto').map(o => (
              <button key={o.value} onClick={() => setPeriod(o.value)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: period === o.value ? 'var(--accent)' : 'transparent', color: period === o.value ? '#fff' : 'var(--text-muted)', fontWeight: period === o.value ? 600 : 400 }}>{o.label}</button>
            ))}
          </div>
          <span style={{ color: 'var(--border)', fontSize: 18 }}>|</span>
          {/* Period: historical */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-inset)', borderRadius: 'var(--r-md)', padding: 3, border: '1px solid var(--border)' }}>
            {PERIOD_OPTIONS.filter(o => o.group === 'historico').map(o => (
              <button key={o.value} onClick={() => setPeriod(o.value)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: period === o.value ? 'oklch(55% 0.15 260)' : 'transparent', color: period === o.value ? '#fff' : 'var(--text-muted)', fontWeight: period === o.value ? 600 : 400 }}>{o.label}</button>
            ))}
          </div>
          <button onClick={() => setPeriod('custom')} style={{ padding: '6px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, background: period === 'custom' ? 'oklch(55% 0.12 145)' : 'var(--bg-panel)', color: period === 'custom' ? '#fff' : 'var(--text-muted)', fontWeight: period === 'custom' ? 600 : 400 }}>
            <Icon name="calendar" size={13} /> Rango
          </button>
          {/* Vendor filter */}
          {isOwner && allVendors.length > 0 && (
            <>
              <span style={{ color: 'var(--border)', fontSize: 18 }}>|</span>
              <select value={selectedVendor} onChange={e => setVendor(e.target.value)} style={{ padding: '6px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
                <option value="todos">Todos los vendedores</option>
                {allVendors.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 'auto' }}>{loading ? '…' : `${filtered.length} registros`}</span>
          <button onClick={exportExcel} disabled={filtered.length === 0 || loading} className="btn secondary sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="doc" size={14} /> Exportar Excel
          </button>
        </div>

        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-inset)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <Icon name="calendar" size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Desde</span>
            <input type="date" className="input" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)} style={{ width: 150, fontSize: 13 }} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>hasta</span>
            <input type="date" className="input" value={customTo} min={customFrom} max={toInputDate(today)} onChange={e => setCustomTo(e.target.value)} style={{ width: 150, fontSize: 13 }} />
            {loading && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Buscando registros históricos…</span>}
          </div>
        )}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>⏳ Cargando datos históricos…</div>}

      {!loading && (
        <>
          {/* ── Ranking view ── */}
          {mainView === 'ranking' && isOwner && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Global KPIs */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <KpiChip label="Vendedores"       value={vendorStats.length}     color="var(--text)" />
                <KpiChip label="Total acciones"   value={globalKPIs.total}        color="var(--accent)" />
                <KpiChip label="Contactos únicos" value={globalKPIs.contactos}    color="var(--info)" />
                <KpiChip label="Llamadas"         value={globalKPIs.llamadas}    color="var(--success)" />
                <KpiChip label="WhatsApp"         value={globalKPIs.whatsapps}   color="oklch(42% 0.18 145)" />
                <KpiChip label="Emails"           value={globalKPIs.emails}      color="oklch(65% 0.14 260)" />
                <KpiChip label="Notas"            value={globalKPIs.notas}        color="var(--text-muted)" />
                <KpiChip label="Cambios ↑"        value={vendorStats.reduce((s, v) => s + v.cambiosPos, 0)} color="var(--info)" />
                <KpiChip label="Ganados"          value={vendorStats.reduce((s, v) => s + v.cierre.ganados, 0)} color="var(--success)" />
              </div>
              {/* Semaphore legend */}
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Semáforo de rendimiento:</span>
                {[['var(--success)', 'Top del equipo'], ['oklch(65% 0.15 75)', 'Rendimiento medio'], ['var(--danger)', 'Por debajo del promedio']].map(([color, label]) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} /> {label}
                  </span>
                ))}
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <RankingTable stats={vendorStats} period={period} />
              </div>
            </div>
          )}

          {/* ── Por Vendedor view ── */}
          {(mainView === 'vendedores' || !isOwner) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {vendorStats.map(s => (
                <VendorSection
                  key={s.vendorName}
                  stats={s}
                  contacts={contacts}
                  deals={deals}
                  cutoff={cutoff}
                  ceiling={ceiling}
                  allStats={vendorStats}
                  defaultOpen={selectedVendor !== 'todos' || vendorStats.length === 1}
                />
              ))}
            </div>
          )}

          {/* ── Evolución global view ── */}
          {mainView === 'evolucion' && isOwner && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Actividad total del equipo — {periodLabel}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {[['var(--success)', 'Llamadas'], ['var(--accent)', 'Emails'], ['oklch(52% 0.18 145)', 'WhatsApp'], ['var(--text-muted)', 'Notas'], ['var(--info)', 'Otros']].map(([color, label]) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} /> {label}</span>
                  ))}
                </div>
                <EvolucionChart regs={filtered} cutoff={cutoff} ceiling={ceiling} height={180} />
              </div>
              {vendorStats.map(s => (
                <div key={s.vendorName} className="card" style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Avatar name={s.vendorName} tone={VENDOR_TONES[vendorStats.indexOf(s) % VENDOR_TONES.length]} size="sm" />
                    <span style={{ fontWeight: 600 }}>{s.vendorName}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {s.kpis.total} acciones · {s.diasActivos} días activos</span>
                  </div>
                  <EvolucionChart regs={s.regs} cutoff={cutoff} ceiling={ceiling} height={90} />
                </div>
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Sin registros en este período</div>
              <div style={{ fontSize: 13, marginTop: 6, maxWidth: 420, margin: '8px auto 0' }}>Los registros se generan cuando los vendedores hacen cambios de etapa, notas, llamadas o emails desde el perfil del contacto.</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
