'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import Icon from '@/components/ui/Icon'
import Avatar from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/client'
import type { TeamMember, HistorialLead, HistorialTipo } from '@/lib/types'
import * as XLSX from 'xlsx'

type Period = 'hoy' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'año' | 'año_ant' | 'custom'
type View   = 'contactos' | 'detalle'

interface Props {
  registros:     HistorialLead[]
  members:       TeamMember[]
  isOwner:       boolean
  userId:        string
  currentUserId: string
}

const TIPO_STYLE: Record<HistorialTipo, { bg: string; color: string; label: string }> = {
  ASIGNACION:    { bg: 'var(--warning-soft)',  color: 'oklch(48% 0.15 75)',  label: 'Asignación'   },
  CAMBIO_ESTADO: { bg: 'var(--info-soft)',     color: 'var(--info)',          label: 'Cambio etapa' },
  NOTA:          { bg: 'var(--bg-panel)',       color: 'var(--text-muted)',   label: 'Nota'         },
  LLAMADA:       { bg: 'var(--success-soft)',  color: 'var(--success)',       label: 'Llamada'      },
  EMAIL:         { bg: 'var(--accent-soft)',   color: 'var(--accent)',        label: 'Email'        },
}

const PERIOD_OPTIONS: { value: Period; label: string; group: 'corto' | 'historico' | 'custom' }[] = [
  { value: 'hoy',      label: 'Hoy',         group: 'corto'    },
  { value: 'semana',   label: 'Semana',      group: 'corto'    },
  { value: 'mes',      label: 'Mes',         group: 'corto'    },
  { value: 'trimestre',label: 'Trimestre',   group: 'historico'},
  { value: 'semestre', label: 'Semestre',    group: 'historico'},
  { value: 'año',      label: 'Año actual',  group: 'historico'},
  { value: 'año_ant',  label: 'Últ. 12 meses', group: 'historico'},
  { value: 'custom',   label: '📅 Rango',    group: 'custom'   },
]

type AvatarTone = 'accent' | 'info' | 'success' | 'warning' | 'danger'
const VENDOR_TONES: AvatarTone[] = ['accent', 'success', 'warning', 'info', 'danger']

// ─── Date helpers ─────────────────────────────────────────────────────────────
function startOfDay(d: Date)   { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function startOfWeek(d: Date)  {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d); m.setDate(d.getDate() + diff)
  return startOfDay(m)
}
function startOfMonth(d: Date)  { return new Date(d.getFullYear(), d.getMonth(), 1) }
function daysAgo(n: number)     { const d = new Date(); d.setDate(d.getDate() - n); return startOfDay(d) }
function startOfYear(d: Date)   { return new Date(d.getFullYear(), 0, 1) }
function toInputDate(d: Date)   { return d.toISOString().slice(0, 10) }

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
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
function fmtDateShort(d: Date) {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────
interface KPIs {
  total: number; contactos: number; llamadas: number
  emails: number; notas: number; cambios: number; asignaciones: number
}
function calcKPIs(regs: HistorialLead[]): KPIs {
  return {
    total:        regs.length,
    contactos:    new Set(regs.map(r => r.nombre)).size,
    llamadas:     regs.filter(r => r.tipo === 'LLAMADA').length,
    emails:       regs.filter(r => r.tipo === 'EMAIL').length,
    notas:        regs.filter(r => r.tipo === 'NOTA').length,
    cambios:      regs.filter(r => r.tipo === 'CAMBIO_ESTADO').length,
    asignaciones: regs.filter(r => r.tipo === 'ASIGNACION').length,
  }
}

// ─── Contact frequency ────────────────────────────────────────────────────────
interface ContactFreq {
  nombre: string; numero: string | null; count: number
  lastDate: string; tipos: Set<HistorialTipo>; interactions: HistorialLead[]
}
function calcContactFreq(regs: HistorialLead[]): ContactFreq[] {
  const map = new Map<string, ContactFreq>()
  for (const r of regs) {
    if (!map.has(r.nombre))
      map.set(r.nombre, { nombre: r.nombre, numero: r.numero, count: 0, lastDate: r.fecha, tipos: new Set(), interactions: [] })
    const e = map.get(r.nombre)!
    e.count++
    e.interactions.push(r)
    if (r.fecha > e.lastDate) { e.lastDate = r.fecha; e.numero = r.numero }
    e.tipos.add(r.tipo)
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

// ─── KPI chip ─────────────────────────────────────────────────────────────────
function KpiChip({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'var(--bg-panel)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: '10px 18px', minWidth: 80, gap: 2,
    }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

// ─── Global KPI bar ───────────────────────────────────────────────────────────
function GlobalKpiBar({ kpis, vendorCount }: { kpis: KPIs; vendorCount: number }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <KpiChip label="Vendedores"       value={vendorCount}       color="var(--text)" />
      <KpiChip label="Total acciones"   value={kpis.total}        color="var(--accent)" />
      <KpiChip label="Contactos únicos" value={kpis.contactos}    color="var(--info)" />
      <KpiChip label="Llamadas"         value={kpis.llamadas}     color="var(--success)" />
      <KpiChip label="Emails"           value={kpis.emails}       color="oklch(65% 0.14 260)" />
      <KpiChip label="Notas"            value={kpis.notas}        color="var(--text-muted)" />
      <KpiChip label="Cambios etapa"    value={kpis.cambios}      color="var(--info)" />
    </div>
  )
}

// ─── Vendor section ───────────────────────────────────────────────────────────
function VendorSection({ vendorName, regs, tone, defaultOpen }: {
  vendorName: string; regs: HistorialLead[]; tone: AvatarTone; defaultOpen: boolean
}) {
  const [open, setOpen]                   = useState(defaultOpen)
  const [view, setView]                   = useState<View>('contactos')
  const [expandedContact, setExpanded]    = useState<string | null>(null)
  const [search, setSearch]               = useState('')

  const kpis    = calcKPIs(regs)
  const freq    = calcContactFreq(regs)
  const maxFreq = freq.length > 0 ? freq[0].count : 1

  const filteredRegs = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return regs
    return regs.filter(r =>
      r.nombre.toLowerCase().includes(q) ||
      (r.numero ?? '').includes(q) ||
      (r.mensaje ?? '').toLowerCase().includes(q)
    )
  }, [regs, search])

  const filteredFreq = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return freq
    return freq.filter(f => f.nombre.toLowerCase().includes(q) || (f.numero ?? '').includes(q))
  }, [freq, search])

  const chipStyle: React.CSSProperties = {
    padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border)' : 'none', background: 'var(--bg-panel)',
        }}
        onClick={() => setOpen(o => !o)}
      >
        <Avatar name={vendorName} tone={tone} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{vendorName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {kpis.total} acciones · {kpis.contactos} contactos únicos
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {kpis.llamadas > 0 && <span style={{ ...chipStyle, background: 'var(--success-soft)', color: 'var(--success)' }}>📞 {kpis.llamadas}</span>}
          {kpis.emails   > 0 && <span style={{ ...chipStyle, background: 'var(--accent-soft)',  color: 'var(--accent)'  }}>✉️ {kpis.emails}</span>}
          {kpis.notas    > 0 && <span style={{ ...chipStyle, background: 'var(--bg-inset)',     color: 'var(--text-muted)' }}>📝 {kpis.notas}</span>}
          {kpis.cambios  > 0 && <span style={{ ...chipStyle, background: 'var(--info-soft)',    color: 'var(--info)'    }}>🔄 {kpis.cambios}</span>}
        </div>
        <Icon name="chev_down" size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </div>

      {open && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* KPI row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <KpiChip label="Total acciones"   value={kpis.total}        color="var(--text)" />
            <KpiChip label="Contactos únicos" value={kpis.contactos}    color="var(--accent)" />
            <KpiChip label="Llamadas"         value={kpis.llamadas}     color="var(--success)" />
            <KpiChip label="Emails"           value={kpis.emails}       color="oklch(65% 0.14 260)" />
            <KpiChip label="Notas"            value={kpis.notas}        color="var(--text-muted)" />
            <KpiChip label="Cambios etapa"    value={kpis.cambios}      color="var(--info)" />
            <KpiChip label="Asignaciones"     value={kpis.asignaciones} color="oklch(48% 0.15 75)" />
          </div>

          {/* View tabs + search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-inset)', borderRadius: 8, padding: 3 }}>
              {([['contactos', 'Contactos'], ['detalle', 'Detalle cronológico']] as [View, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                  background: view === v ? 'var(--bg-panel)' : 'transparent',
                  color:      view === v ? 'var(--text)'     : 'var(--text-muted)',
                  fontWeight: view === v ? 600               : 400,
                  boxShadow:  view === v ? '0 1px 3px rgba(0,0,0,.15)' : 'none',
                }}>{l}</button>
              ))}
            </div>
            <input
              className="input" placeholder="Buscar contacto..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: 200, fontSize: 12 }}
            />
          </div>

          {/* ── Contactos view ── */}
          {view === 'contactos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredFreq.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Sin registros</div>
              )}
              {filteredFreq.map(cf => {
                const isExp    = expandedContact === cf.nombre
                const barPct   = Math.round((cf.count / maxFreq) * 100)
                const barColor = cf.count >= 4 ? 'var(--success)' : cf.count >= 2 ? 'var(--accent)' : 'var(--text-muted)'
                return (
                  <div key={cf.nombre} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: isExp ? 'var(--bg-inset)' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}
                      onClick={() => setExpanded(isExp ? null : cf.nombre)}>
                      <div style={{ width: 80, flexShrink: 0 }}>
                        <div style={{ height: 6, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${barPct}%`, background: barColor, borderRadius: 4 }} />
                        </div>
                      </div>
                      <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 15, color: barColor }}>{cf.count}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{cf.nombre}</div>
                        {cf.numero && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{cf.numero}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {Array.from(cf.tipos).map(t => {
                          const s = TIPO_STYLE[t]
                          return <span key={t} style={{ background: s.bg, color: s.color, padding: '2px 7px', borderRadius: 20, fontSize: 10.5, fontWeight: 500 }}>{s.label}</span>
                        })}
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{fmtDate(cf.lastDate)}</span>
                      <Icon name="chev_down" size={12} style={{ transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                    </div>
                    {isExp && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {cf.interactions.slice().sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).map((r, i) => {
                          const s = TIPO_STYLE[r.tipo]
                          return (
                            <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5 }}>
                              <span style={{ color: 'var(--text-muted)', minWidth: 20, textAlign: 'right', paddingTop: 1 }}>{i + 1}.</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', paddingTop: 1 }}>{fmtDate(r.fecha)}</span>
                              <span style={{ background: s.bg, color: s.color, padding: '1px 7px', borderRadius: 20, fontSize: 10.5, fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</span>
                              {r.etapa_anterior && r.etapa_nueva && (
                                <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>{r.etapa_anterior} → <strong style={{ color: 'var(--text)' }}>{r.etapa_nueva}</strong></span>
                              )}
                              {r.mensaje && <span style={{ color: 'var(--text)', flex: 1 }}>{r.mensaje}</span>}
                              {r.notas   && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.notas}</span>}
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

          {/* ── Detalle cronológico view ── */}
          {view === 'detalle' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Fecha</th>
                    <th>Contacto</th>
                    <th style={{ width: 90 }}>Teléfono</th>
                    <th style={{ width: 110 }}>Tipo</th>
                    <th>Acción / Mensaje</th>
                    <th style={{ width: 160 }}>Cambio de etapa</th>
                    <th>Notas</th>
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
                        <td><span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</span></td>
                        <td style={{ fontSize: 13 }}>{r.mensaje ?? ''}</td>
                        <td style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {r.etapa_anterior && r.etapa_nueva ? <>{r.etapa_anterior} → <strong style={{ color: 'var(--text)' }}>{r.etapa_nueva}</strong></> : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.notas ?? ''}</td>
                      </tr>
                    )
                  })}
                  {filteredRegs.length === 0 && (
                    <tr><td colSpan={7}><div className="empty"><h4>Sin registros</h4></div></td></tr>
                  )}
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
export default function GestionClient({ registros: initialRegistros, members, isOwner, userId, currentUserId }: Props) {
  const [period, setPeriod]               = useState<Period>('hoy')
  const [selectedVendor, setSelectedVendor] = useState('todos')
  const [allData, setAllData]             = useState<HistorialLead[]>(initialRegistros)
  const [loading, setLoading]             = useState(false)
  // Custom range state
  const today = new Date()
  const [customFrom, setCustomFrom] = useState(toInputDate(startOfMonth(today)))
  const [customTo,   setCustomTo]   = useState(toInputDate(today))

  const supabase = createClient()

  // The oldest date pre-loaded by the server is ~400 days ago
  const serverCutoff = useMemo(() => daysAgo(400), [])

  // Fetch data from Supabase when custom range exceeds what the server loaded
  const fetchRange = useCallback(async (from: Date, to: Date) => {
    if (from >= serverCutoff) return // already in pre-loaded data
    setLoading(true)
    try {
      const toISO   = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59).toISOString()
      const fromISO = from.toISOString()

      let data: HistorialLead[] = []

      if (isOwner) {
        const { data: hist } = await supabase
          .from('historial_leads').select('*')
          .eq('user_id', userId).gte('fecha', fromISO).lte('fecha', toISO)
          .order('fecha', { ascending: false })
        data = (hist as HistorialLead[]) ?? []
      } else {
        const { data: myContacts } = await supabase.from('contacts').select('id').eq('user_id', userId)
        const ids = (myContacts ?? []).map((c: { id: string }) => c.id)
        if (ids.length > 0) {
          const { data: hist } = await supabase
            .from('historial_leads').select('*')
            .eq('user_id', userId).in('contact_id', ids)
            .gte('fecha', fromISO).lte('fecha', toISO)
            .order('fecha', { ascending: false })
          data = (hist as HistorialLead[]) ?? []
        }
      }
      // Merge with initialRegistros (dedup by id)
      const merged = [...data]
      const ids = new Set(data.map(r => r.id))
      initialRegistros.forEach(r => { if (!ids.has(r.id)) merged.push(r) })
      setAllData(merged)
    } finally {
      setLoading(false)
    }
  }, [userId, isOwner, serverCutoff, supabase, initialRegistros])

  // Trigger fetch when custom dates go beyond pre-loaded range
  useEffect(() => {
    if (period !== 'custom') return
    const from = new Date(customFrom)
    if (from < serverCutoff) fetchRange(from, new Date(customTo))
  }, [period, customFrom, customTo, fetchRange, serverCutoff])

  const now = new Date()

  // Compute active date range
  const { cutoff, ceiling } = useMemo(() => {
    if (period === 'custom') {
      return {
        cutoff:  new Date(customFrom),
        ceiling: new Date(new Date(customTo).getFullYear(), new Date(customTo).getMonth(), new Date(customTo).getDate(), 23, 59, 59),
      }
    }
    return { cutoff: getCutoff(period, now), ceiling: new Date(8640000000000000) }
  }, [period, customFrom, customTo])

  // Filter by period
  const periodRegs = useMemo(
    () => allData.filter(r => { const d = new Date(r.fecha); return d >= cutoff && d <= ceiling }),
    [allData, cutoff, ceiling]
  )

  // Vendor list
  const allVendors = useMemo(() => {
    if (members.length > 0) return members.map(m => m.name)
    const s = new Set<string>()
    allData.forEach(r => { if (r.vendedor) s.add(r.vendedor) })
    return Array.from(s).sort()
  }, [allData, members])

  // Filter by selected vendor
  const filtered = useMemo(() => {
    if (selectedVendor === 'todos') return periodRegs
    return periodRegs.filter(r => r.vendedor === selectedVendor)
  }, [periodRegs, selectedVendor])

  // Group by vendor
  const byVendor = useMemo(() => {
    const map = new Map<string, HistorialLead[]>()
    const list = selectedVendor === 'todos' ? allVendors : [selectedVendor]
    list.forEach(v => map.set(v, []))
    filtered.forEach(r => {
      const v = r.vendedor || '(Sin asignar)'
      if (!map.has(v)) map.set(v, [])
      map.get(v)!.push(r)
    })
    return map
  }, [filtered, allVendors, selectedVendor])

  const globalKPIs = calcKPIs(filtered)

  // Period label
  const periodLabel = useMemo(() => {
    if (period === 'custom') return `${fmtDateShort(new Date(customFrom))} → ${fmtDateShort(new Date(customTo))}`
    const c = getCutoff(period, now)
    switch (period) {
      case 'hoy':       return `Hoy — ${now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}`
      case 'semana':    return `Esta semana (desde el ${fmtDateShort(c)})`
      case 'mes':       return `Este mes — ${now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`
      case 'trimestre': return `Últimos 3 meses (desde el ${fmtDateShort(c)})`
      case 'semestre':  return `Últimos 6 meses (desde el ${fmtDateShort(c)})`
      case 'año':       return `Año ${now.getFullYear()} (desde el ${fmtDateShort(c)})`
      case 'año_ant':   return `Últimos 12 meses (desde el ${fmtDateShort(c)})`
      default:          return ''
    }
  }, [period, customFrom, customTo])

  // Export to Excel
  function exportExcel() {
    const wb = XLSX.utils.book_new()

    const resumenRows = Array.from(byVendor.entries()).map(([vendorName, regs]) => {
      const k    = calcKPIs(regs)
      const freq = calcContactFreq(regs)
      return {
        Vendedor:                  vendorName,
        'Total acciones':          k.total,
        'Contactos únicos':        k.contactos,
        Llamadas:                  k.llamadas,
        Emails:                    k.emails,
        Notas:                     k.notas,
        'Cambios de etapa':        k.cambios,
        Asignaciones:              k.asignaciones,
        'Contacto más gestionado': freq[0]?.nombre ?? '',
        'Veces contactado (max)':  freq[0]?.count  ?? 0,
      }
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), 'Resumen vendedores')

    const detalleRows = filtered.map(r => ({
      Fecha:              r.fecha ? new Date(r.fecha).toLocaleString('es-AR', { hour12: false }) : '',
      Vendedor:           r.vendedor ?? '',
      Contacto:           r.nombre,
      Teléfono:           r.numero ?? '',
      Tipo:               TIPO_STYLE[r.tipo]?.label ?? r.tipo,
      'Acción / Mensaje': r.mensaje ?? '',
      'Etapa anterior':   r.etapa_anterior ?? '',
      'Etapa nueva':      r.etapa_nueva ?? '',
      Notas:              r.notas ?? '',
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalleRows), 'Detalle cronológico')

    const freqRows: object[] = []
    byVendor.forEach((regs, vendorName) => {
      calcContactFreq(regs).forEach(cf => {
        freqRows.push({
          Vendedor:               vendorName,
          Contacto:               cf.nombre,
          Teléfono:               cf.numero ?? '',
          'Veces contactado':     cf.count,
          'Último contacto':      cf.lastDate ? new Date(cf.lastDate).toLocaleString('es-AR', { hour12: false }) : '',
          'Tipos de interacción': Array.from(cf.tipos).map(t => TIPO_STYLE[t]?.label ?? t).join(', '),
        })
      })
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(freqRows), 'Frecuencia contactos')

    const slug     = period === 'custom' ? `${customFrom}_${customTo}` : period.replace('_', '-')
    const dateSlug = now.toISOString().slice(0, 10)
    XLSX.writeFile(wb, `gestion_vendedores_${slug}_${dateSlug}.xlsx`)
  }

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

      {/* ── Period selector ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

          {/* Short periods */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-inset)', borderRadius: 'var(--r-md)', padding: 3, border: '1px solid var(--border)' }}>
            {PERIOD_OPTIONS.filter(o => o.group === 'corto').map(o => (
              <button key={o.value} onClick={() => setPeriod(o.value)} style={{
                padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
                background: period === o.value ? 'var(--accent)'    : 'transparent',
                color:      period === o.value ? '#fff'             : 'var(--text-muted)',
                fontWeight: period === o.value ? 600                : 400,
              }}>{o.label}</button>
            ))}
          </div>

          {/* Separator */}
          <span style={{ color: 'var(--border)', fontSize: 18, userSelect: 'none' }}>|</span>

          {/* Historical periods */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-inset)', borderRadius: 'var(--r-md)', padding: 3, border: '1px solid var(--border)' }}>
            {PERIOD_OPTIONS.filter(o => o.group === 'historico').map(o => (
              <button key={o.value} onClick={() => setPeriod(o.value)} style={{
                padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
                background: period === o.value ? 'oklch(55% 0.15 260)' : 'transparent',
                color:      period === o.value ? '#fff'                : 'var(--text-muted)',
                fontWeight: period === o.value ? 600                   : 400,
              }}>{o.label}</button>
            ))}
          </div>

          {/* Custom range toggle */}
          <button onClick={() => setPeriod('custom')} style={{
            padding: '6px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
            cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
            background: period === 'custom' ? 'oklch(55% 0.12 145)' : 'var(--bg-panel)',
            color:      period === 'custom' ? '#fff'                : 'var(--text-muted)',
            fontWeight: period === 'custom' ? 600                   : 400,
          }}>
            <Icon name="calendar" size={13} />
            Rango personalizado
          </button>

          {/* Vendor filter */}
          {isOwner && allVendors.length > 0 && (
            <>
              <span style={{ color: 'var(--border)', fontSize: 18, userSelect: 'none' }}>|</span>
              <select value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)} style={{
                padding: '6px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
                background: 'var(--bg-panel)', color: 'var(--text)', fontSize: 13, cursor: 'pointer',
              }}>
                <option value="todos">Todos los vendedores</option>
                {allVendors.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </>
          )}

          {/* Count + export */}
          <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 'auto' }}>
            {loading ? '…' : `${filtered.length} registros · ${globalKPIs.contactos} contactos`}
          </span>
          <button onClick={exportExcel} disabled={filtered.length === 0 || loading} className="btn secondary sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="doc" size={14} />
            Exportar Excel
          </button>
        </div>

        {/* Custom date pickers — shown only when 'custom' is active */}
        {period === 'custom' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '12px 16px', background: 'var(--bg-inset)', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
          }}>
            <Icon name="calendar" size={15} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Desde</span>
            <input
              type="date" className="input" value={customFrom}
              max={customTo}
              onChange={e => setCustomFrom(e.target.value)}
              style={{ width: 155, fontSize: 13 }}
            />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>hasta</span>
            <input
              type="date" className="input" value={customTo}
              min={customFrom} max={toInputDate(today)}
              onChange={e => setCustomTo(e.target.value)}
              style={{ width: 155, fontSize: 13 }}
            />
            {loading && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Buscando registros históricos…
              </span>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {!loading && `${filtered.length} registros encontrados`}
            </span>
          </div>
        )}
      </div>

      {/* Global KPIs (owner, todos) */}
      {isOwner && selectedVendor === 'todos' && !loading && (
        <div style={{ marginBottom: 12 }}>
          <GlobalKpiBar kpis={globalKPIs} vendorCount={byVendor.size} />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          <div style={{ fontWeight: 500 }}>Cargando datos históricos…</div>
        </div>
      )}

      {/* Per-vendor sections */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from(byVendor.entries()).map(([vendorName, regs], idx) => (
            <VendorSection
              key={vendorName}
              vendorName={vendorName}
              regs={regs}
              tone={VENDOR_TONES[idx % VENDOR_TONES.length]}
              defaultOpen={selectedVendor !== 'todos' || byVendor.size === 1}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Sin registros en este período</div>
          <div style={{ fontSize: 13, marginTop: 6, maxWidth: 420, margin: '8px auto 0' }}>
            Los registros se generan cuando los vendedores hacen cambios de etapa, notas, llamadas o emails desde el perfil del contacto.
          </div>
        </div>
      )}
    </div>
  )
}
