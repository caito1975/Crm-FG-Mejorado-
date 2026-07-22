'use client'
import { useState, useMemo } from 'react'
import Icon from '@/components/ui/Icon'
import Avatar from '@/components/ui/Avatar'
import type { TeamMember, HistorialLead, HistorialTipo } from '@/lib/types'

type Period = 'hoy' | 'semana' | 'mes'
type View   = 'resumen' | 'detalle' | 'contactos'

interface Props {
  registros:     HistorialLead[]
  members:       TeamMember[]
  isOwner:       boolean
  userId:        string
  currentUserId: string
}

const TIPO_STYLE: Record<HistorialTipo, { bg: string; color: string; label: string; icon: string }> = {
  ASIGNACION:    { bg: 'var(--warning-soft)',  color: 'oklch(48% 0.15 75)',  label: 'Asignación',    icon: 'team' },
  CAMBIO_ESTADO: { bg: 'var(--info-soft)',     color: 'var(--info)',         label: 'Cambio etapa',  icon: 'pipeline' },
  NOTA:          { bg: 'var(--bg-panel)',       color: 'var(--text-muted)',  label: 'Nota',          icon: 'tasks' },
  LLAMADA:       { bg: 'var(--success-soft)',  color: 'var(--success)',      label: 'Llamada',       icon: 'calendar' },
  EMAIL:         { bg: 'var(--accent-soft)',   color: 'var(--accent)',       label: 'Email',         icon: 'inbox' },
}

type AvatarTone = 'accent' | 'info' | 'success' | 'warning' | 'danger'
const VENDOR_TONES: AvatarTone[] = ['accent', 'success', 'warning', 'info', 'danger']

function startOfDay(d: Date)   { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function startOfWeek(d: Date)  {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d); m.setDate(d.getDate() + diff)
  return startOfDay(m)
}
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

interface KPIs {
  total:    number
  contactos: number
  llamadas:  number
  emails:    number
  notas:     number
  cambios:   number
  asignaciones: number
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

interface ContactFreq {
  nombre:   string
  numero:   string | null
  count:    number
  lastDate: string
  tipos:    Set<HistorialTipo>
  interactions: HistorialLead[]
}

function calcContactFreq(regs: HistorialLead[]): ContactFreq[] {
  const map = new Map<string, ContactFreq>()
  for (const r of regs) {
    const key = r.nombre
    if (!map.has(key)) {
      map.set(key, { nombre: r.nombre, numero: r.numero, count: 0, lastDate: r.fecha, tipos: new Set(), interactions: [] })
    }
    const e = map.get(key)!
    e.count++
    e.interactions.push(r)
    if (r.fecha > e.lastDate) { e.lastDate = r.fecha; e.numero = r.numero }
    e.tipos.add(r.tipo)
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

// ─── KPI chip ────────────────────────────────────────────────────────────────
function KpiChip({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-panel)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: '10px 18px', minWidth: 80, gap: 2,
    }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text)', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

// ─── Vendor section ───────────────────────────────────────────────────────────
interface VendorSectionProps {
  vendorName: string
  regs:       HistorialLead[]
  tone:       AvatarTone
  defaultOpen: boolean
}

function VendorSection({ vendorName, regs, tone, defaultOpen }: VendorSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [view, setView] = useState<View>('contactos')
  const [expandedContact, setExpandedContact] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Vendor header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px', cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          background: 'var(--bg-panel)',
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
        {/* Mini KPI pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {kpis.llamadas > 0 && (
            <span style={{ ...chipStyle, background: 'var(--success-soft)', color: 'var(--success)' }}>
              📞 {kpis.llamadas}
            </span>
          )}
          {kpis.emails > 0 && (
            <span style={{ ...chipStyle, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              ✉️ {kpis.emails}
            </span>
          )}
          {kpis.notas > 0 && (
            <span style={{ ...chipStyle, background: 'var(--bg-inset)', color: 'var(--text-muted)' }}>
              📝 {kpis.notas}
            </span>
          )}
          {kpis.cambios > 0 && (
            <span style={{ ...chipStyle, background: 'var(--info-soft)', color: 'var(--info)' }}>
              🔄 {kpis.cambios}
            </span>
          )}
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
              {([
                ['contactos', 'Contactos'],
                ['detalle',   'Detalle cronológico'],
              ] as [View, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                  background: view === v ? 'var(--bg-panel)' : 'transparent',
                  color: view === v ? 'var(--text)' : 'var(--text-muted)',
                  fontWeight: view === v ? 600 : 400,
                  boxShadow: view === v ? '0 1px 3px rgba(0,0,0,.15)' : 'none',
                }}>
                  {l}
                </button>
              ))}
            </div>
            <input
              className="input"
              placeholder="Buscar contacto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 200, fontSize: 12 }}
            />
          </div>

          {/* ─── Contactos view ─── */}
          {view === 'contactos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredFreq.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  Sin registros
                </div>
              )}
              {filteredFreq.map(cf => {
                const isExpCont = expandedContact === cf.nombre
                const barPct    = Math.round((cf.count / maxFreq) * 100)
                return (
                  <div key={cf.nombre} style={{
                    border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden',
                    background: isExpCont ? 'var(--bg-inset)' : 'transparent',
                  }}>
                    {/* Contact row */}
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        cursor: cf.interactions.length > 0 ? 'pointer' : 'default',
                      }}
                      onClick={() => setExpandedContact(isExpCont ? null : cf.nombre)}
                    >
                      {/* Bar */}
                      <div style={{ width: 80, flexShrink: 0 }}>
                        <div style={{
                          height: 6, borderRadius: 4, background: 'var(--border)',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', width: `${barPct}%`,
                            background: cf.count >= 4 ? 'var(--success)' : cf.count >= 2 ? 'var(--accent)' : 'var(--text-muted)',
                            borderRadius: 4,
                          }} />
                        </div>
                      </div>
                      {/* Count badge */}
                      <span style={{
                        minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 15,
                        color: cf.count >= 4 ? 'var(--success)' : cf.count >= 2 ? 'var(--accent)' : 'var(--text-muted)',
                      }}>
                        {cf.count}
                      </span>
                      {/* Name + phone */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{cf.nombre}</div>
                        {cf.numero && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {cf.numero}
                          </div>
                        )}
                      </div>
                      {/* Tipo tags */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {Array.from(cf.tipos).map(t => {
                          const s = TIPO_STYLE[t]
                          return (
                            <span key={t} style={{
                              background: s.bg, color: s.color,
                              padding: '2px 7px', borderRadius: 20, fontSize: 10.5, fontWeight: 500,
                            }}>
                              {s.label}
                            </span>
                          )
                        })}
                      </div>
                      {/* Last date */}
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                        {fmtDate(cf.lastDate)}
                      </span>
                      <Icon name="chev_down" size={12} style={{ transform: isExpCont ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                    </div>

                    {/* Expanded: interaction list */}
                    {isExpCont && (
                      <div style={{
                        borderTop: '1px solid var(--border)',
                        padding: '8px 14px 12px',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        {cf.interactions
                          .slice()
                          .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                          .map((r, i) => {
                            const s = TIPO_STYLE[r.tipo]
                            return (
                              <div key={r.id} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5,
                              }}>
                                <span style={{ color: 'var(--text-muted)', minWidth: 20, textAlign: 'right', paddingTop: 1 }}>
                                  {i + 1}.
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', paddingTop: 1 }}>
                                  {fmtDate(r.fecha)}
                                </span>
                                <span style={{
                                  background: s.bg, color: s.color,
                                  padding: '1px 7px', borderRadius: 20, fontSize: 10.5, fontWeight: 500, whiteSpace: 'nowrap',
                                }}>
                                  {s.label}
                                </span>
                                {r.etapa_anterior && r.etapa_nueva && (
                                  <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                                    {r.etapa_anterior} → <strong style={{ color: 'var(--text)' }}>{r.etapa_nueva}</strong>
                                  </span>
                                )}
                                {r.mensaje && (
                                  <span style={{ color: 'var(--text)', flex: 1 }}>{r.mensaje}</span>
                                )}
                                {r.notas && (
                                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.notas}</span>
                                )}
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

          {/* ─── Detalle cronológico view ─── */}
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
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                          {fmtDate(r.fecha)}
                        </td>
                        <td style={{ fontWeight: 500 }}>{r.nombre}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{r.numero ?? '—'}</td>
                        <td>
                          <span style={{
                            background: s.bg, color: s.color,
                            padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
                          }}>
                            {s.label}
                          </span>
                        </td>
                        <td style={{ fontSize: 13 }}>{r.mensaje ?? ''}</td>
                        <td style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {r.etapa_anterior && r.etapa_nueva
                            ? <>{r.etapa_anterior} → <strong style={{ color: 'var(--text)' }}>{r.etapa_nueva}</strong></>
                            : '—'
                          }
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.notas ?? ''}</td>
                      </tr>
                    )
                  })}
                  {filteredRegs.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty"><h4>Sin registros</h4></div>
                      </td>
                    </tr>
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

// ─── Chip style helper ────────────────────────────────────────────────────────
const chipStyle: React.CSSProperties = {
  padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 500,
  display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
}

// ─── Global KPI bar ───────────────────────────────────────────────────────────
function GlobalKpiBar({ kpis, vendorCount }: { kpis: KPIs; vendorCount: number }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <KpiChip label="Vendedores activos" value={vendorCount}      color="var(--text)" />
      <KpiChip label="Total acciones"     value={kpis.total}       color="var(--accent)" />
      <KpiChip label="Contactos únicos"   value={kpis.contactos}   color="var(--info)" />
      <KpiChip label="Llamadas"           value={kpis.llamadas}    color="var(--success)" />
      <KpiChip label="Emails"             value={kpis.emails}      color="oklch(65% 0.14 260)" />
      <KpiChip label="Notas"              value={kpis.notas}       color="var(--text-muted)" />
      <KpiChip label="Cambios etapa"      value={kpis.cambios}     color="var(--info)" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function GestionClient({ registros, members, isOwner }: Props) {
  const [period, setPeriod]               = useState<Period>('hoy')
  const [selectedVendor, setSelectedVendor] = useState('todos')

  const now    = new Date()
  const cutoff = period === 'hoy'    ? startOfDay(now)
               : period === 'semana' ? startOfWeek(now)
               :                      startOfMonth(now)

  // Filter by period
  const periodRegs = useMemo(
    () => registros.filter(r => new Date(r.fecha) >= cutoff),
    [registros, period]
  )

  // All vendor names from team_members OR derived from historial
  const allVendors = useMemo(() => {
    if (members.length > 0) return members.map(m => m.name)
    const s = new Set<string>()
    registros.forEach(r => { if (r.vendedor) s.add(r.vendedor) })
    return Array.from(s).sort()
  }, [registros, members])

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
    // Also capture registros with vendedores not in the members list
    filtered.forEach(r => {
      const v = r.vendedor || '(Sin asignar)'
      if (!map.has(v)) map.set(v, [])
      map.get(v)!.push(r)
    })
    return map
  }, [filtered, allVendors, selectedVendor])

  // Global KPIs
  const globalKPIs = calcKPIs(filtered)

  const periodLabel =
    period === 'hoy'    ? `Hoy — ${now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}` :
    period === 'semana' ? `Esta semana (desde el ${fmtDateShort(cutoff.toISOString())})` :
                          `Este mes — ${now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="reports" size={20} />
            Gestión de Vendedores
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Seguimiento de actividad comercial — {periodLabel}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        {/* Period selector */}
        <div style={{
          display: 'flex', gap: 2, background: 'var(--bg-inset)',
          borderRadius: 'var(--r-md)', padding: 3, border: '1px solid var(--border)',
        }}>
          {(['hoy', 'semana', 'mes'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '6px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
              background:  period === p ? 'var(--accent)'      : 'transparent',
              color:       period === p ? '#fff'               : 'var(--text-muted)',
              fontWeight:  period === p ? 600                  : 400,
            }}>
              {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        {/* Vendor filter (owner only) */}
        {isOwner && allVendors.length > 0 && (
          <select
            value={selectedVendor}
            onChange={e => setSelectedVendor(e.target.value)}
            style={{
              padding: '6px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
              background: 'var(--bg-panel)', color: 'var(--text)', fontSize: 13, cursor: 'pointer',
            }}
          >
            <option value="todos">Todos los vendedores</option>
            {allVendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        )}

        <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 'auto' }}>
          {filtered.length} registros · {globalKPIs.contactos} contactos
        </span>
      </div>

      {/* Global KPIs (owner, todos) */}
      {isOwner && selectedVendor === 'todos' && (
        <div style={{ marginBottom: 8 }}>
          <GlobalKpiBar kpis={globalKPIs} vendorCount={byVendor.size} />
        </div>
      )}

      {/* Per-vendor sections */}
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

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Sin registros en este período</div>
          <div style={{ fontSize: 13, marginTop: 6, maxWidth: 400, margin: '8px auto 0' }}>
            Los registros se generan cuando los vendedores hacen cambios de etapa, notas, llamadas o emails desde el perfil del contacto.
          </div>
        </div>
      )}
    </div>
  )
}
