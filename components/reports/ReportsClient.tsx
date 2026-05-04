'use client'
import { useState } from 'react'
import type { Deal, Contact, PipelineStage } from '@/lib/types'
import { useCurrency } from '@/lib/useCurrency'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  FunnelChart, Funnel, LabelList,
  PieChart, Pie, Legend,
} from 'recharts'

type Tab = 'funnel' | 'contactos' | 'pipeline'

interface Props { deals: Deal[]; contacts: Contact[]; stages: PipelineStage[] }

const CHART_COLORS = [
  '#4ade80','#818cf8','#f87171','#fb923c','#facc15',
  '#34d399','#60a5fa','#e879f9','#a78bfa','#38bdf8',
]

// Custom label for funnel bars
const FunnelLabel = (props: any) => {
  const { x, y, width, height, value, name, fill } = props
  if (!width || width < 40) return null
  return (
    <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle"
      fill="#fff" fontSize={12} fontWeight={600}>
      {name}  {value}
    </text>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-panel)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,.15)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || 'var(--text)', display: 'flex', gap: 8 }}>
          <span style={{ color: 'var(--text-muted)' }}>{p.name}:</span>
          <span style={{ fontWeight: 500 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function ReportsClient({ deals, contacts, stages }: Props) {
  const [tab, setTab] = useState<Tab>('funnel')
  const { formatAmount } = useCurrency()

  const won  = deals.filter(d => d.stage_id === 'ganado')
  const lost = deals.filter(d => d.stage_id === 'perdido')
  const open = deals.filter(d => d.stage_id !== 'ganado' && d.stage_id !== 'perdido')

  const totalWon  = won.reduce((s, d) => s + d.amount, 0)
  const totalOpen = open.reduce((s, d) => s + d.amount, 0)
  const closeRate = deals.length > 0 ? Math.round((won.length / deals.length) * 100) : 0

  // Build stage map from actual DB stages, fallback to deal's stage_id as label
  const stageMap: Record<string, string> = {}
  stages.forEach(s => { stageMap[s.id] = s.label })

  const getLabel = (id: string) => stageMap[id] || id.replace(/_/g, ' ').toUpperCase()

  // Funnel data: sorted by count desc, only with deals
  const allStageIds = Array.from(new Set(deals.map(d => d.stage_id)))
  const funnelData = allStageIds
    .map(id => ({
      id,
      name: getLabel(id),
      value: deals.filter(d => d.stage_id === id).length,
      amount: deals.filter(d => d.stage_id === id).reduce((s, d) => s + d.amount, 0),
    }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value)

  const totalDeals = funnelData.reduce((s, d) => s + d.value, 0)
  const funnelWithPct = funnelData.map(d => ({
    ...d,
    label: `${d.name}  ${d.value} (${totalDeals > 0 ? Math.round((d.value / totalDeals) * 100) : 0}%)`,
    fill: CHART_COLORS[funnelData.indexOf(d) % CHART_COLORS.length],
  }))

  // Bar chart data (horizontal) — leads per stage
  const barData = [...funnelData].sort((a, b) => a.value - b.value)

  // Contacts pie data
  const statusCounts = [
    { name: 'Cliente',     value: contacts.filter(c => c.status === 'cliente').length,     fill: '#4ade80' },
    { name: 'Oportunidad', value: contacts.filter(c => c.status === 'oportunidad').length, fill: '#818cf8' },
    { name: 'Lead',        value: contacts.filter(c => c.status === 'lead').length,        fill: '#60a5fa' },
    { name: 'Archivado',   value: contacts.filter(c => c.status === 'archivado').length,   fill: '#94a3b8' },
  ].filter(d => d.value > 0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Reportes</h1>
          <p>Análisis del pipeline y contactos</p>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { lbl: 'Total deals',      val: deals.length.toString(),   color: 'var(--accent)'   },
          { lbl: 'Ganados',          val: won.length.toString(),     color: 'var(--success)'  },
          { lbl: 'Pipeline abierto', val: formatAmount(totalOpen), color: 'var(--info)'     },
          { lbl: 'Tasa de cierre',   val: `${closeRate}%`,           color: 'var(--warning)'  },
        ].map(k => (
          <div key={k.lbl} className="card stat">
            <div className="lbl">{k.lbl}</div>
            <div className="val" style={{ fontSize: 24, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {(['funnel', 'contactos', 'pipeline'] as Tab[]).map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'funnel' ? 'Pipeline' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── FUNNEL TAB ── */}
      {tab === 'funnel' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* Funnel chart */}
          <div className="card">
            <div className="card-head" style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                ● Pipeline
              </span>
            </div>
            <div style={{ padding: '16px 0 8px' }}>
              {funnelWithPct.length === 0
                ? <div className="empty" style={{ padding: '48px 0' }}><p>No hay deals aún.</p></div>
                : (
                  <ResponsiveContainer width="100%" height={Math.max(320, funnelWithPct.length * 52)}>
                    <FunnelChart>
                      <Tooltip content={<CustomTooltip />} />
                      <Funnel dataKey="value" data={funnelWithPct} isAnimationActive lastShapeType="rectangle">
                        {funnelWithPct.map((entry, i) => (
                          <Cell key={entry.id} fill={entry.fill} />
                        ))}
                        <LabelList
                          dataKey="label"
                          position="center"
                          style={{ fill: '#fff', fontSize: 12, fontWeight: 600 }}
                        />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                )
              }
            </div>
          </div>

          {/* Horizontal bar chart */}
          <div className="card">
            <div className="card-head" style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                ● Leads por Etapa
              </span>
            </div>
            <div style={{ padding: '16px 0 8px' }}>
              {barData.length === 0
                ? <div className="empty" style={{ padding: '48px 0' }}><p>No hay deals aún.</p></div>
                : (
                  <ResponsiveContainer width="100%" height={Math.max(320, barData.length * 44)}>
                    <BarChart
                      data={barData}
                      layout="vertical"
                      margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={110}
                        tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-active)' }} />
                      <Bar dataKey="value" name="Deals" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {barData.map((entry, i) => (
                          <Cell key={entry.id} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </div>
          </div>

          {/* Inversión por etapa + Top leads por inversión */}
          <div className="card">
            <div className="card-head" style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                ● Inversión Estimada por Etapa
              </span>
            </div>
            <div style={{ padding: '16px 0 8px' }}>
              {barData.length === 0
                ? <div className="empty" style={{ padding: '32px 0' }}><p>No hay deals aún.</p></div>
                : (
                  <ResponsiveContainer width="100%" height={Math.max(260, barData.length * 44)}>
                    <BarChart
                      data={[...barData].sort((a,b) => a.amount - b.amount)}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 10, bottom: 16 }}
                    >
                      <CartesianGrid horizontal={false} stroke="var(--border)" />
                      <XAxis
                        type="number"
                        tickFormatter={v => formatAmount(Number(v))}
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        axisLine={false} tickLine={false}
                        angle={-35} textAnchor="end" height={48}
                      />
                      <YAxis
                        dataKey="name" type="category" width={110}
                        tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }}
                        axisLine={false} tickLine={false}
                      />
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: 'var(--bg-active)' }}
                        formatter={(v: any) => [formatAmount(Number(v)), 'Inversión']}
                      />
                      <Bar dataKey="amount" name="Inversión" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {[...barData].sort((a,b) => a.amount - b.amount).map((entry, i) => (
                          <Cell key={entry.id} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </div>
          </div>

          <div className="card">
            <div className="card-head" style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                ● Top Leads por Inversión
              </span>
            </div>
            <div style={{ padding: '16px 0 8px' }}>
              {deals.length === 0
                ? <div className="empty" style={{ padding: '32px 0' }}><p>No hay deals aún.</p></div>
                : (() => {
                    // Group by company, sum amounts
                    const byCompany: Record<string, number> = {}
                    deals.filter(d => d.amount > 0).forEach(d => {
                      const company = d.contact?.company || 'Sin empresa'
                      byCompany[company] = (byCompany[company] || 0) + d.amount
                    })
                    const topDeals = Object.entries(byCompany)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 12)
                      .map(([name, amount], i) => ({ id: String(i), name, amount }))
                      .reverse()
                    return (
                      <ResponsiveContainer width="100%" height={Math.max(260, topDeals.length * 36)}>
                        <BarChart
                          data={topDeals}
                          layout="vertical"
                          margin={{ top: 0, right: 16, left: 10, bottom: 16 }}
                        >
                          <CartesianGrid horizontal={false} stroke="var(--border)" />
                          <XAxis
                            type="number"
                            tickFormatter={v => formatAmount(Number(v))}
                            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                            axisLine={false} tickLine={false}
                            angle={-35} textAnchor="end" height={48}
                          />
                          <YAxis
                            dataKey="name" type="category" width={130}
                            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 }}
                            axisLine={false} tickLine={false}
                          />
                          <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ fill: 'var(--bg-active)' }}
                            formatter={(v: any) => [formatAmount(Number(v)), 'Monto']}
                          />
                          <Bar dataKey="amount" name="Monto" radius={[0, 4, 4, 0]} maxBarSize={22}>
                            {topDeals.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )
                  })()
              }
            </div>
          </div>

          {/* Leads por vendedor + Inversión por vendedor */}
          {(() => {
            const byOwner: Record<string, { count: number; amount: number }> = {}
            deals.forEach(d => {
              const owner = d.owner_name || (d.contact as any)?.owner_name || 'Sin asignar'
              if (!byOwner[owner]) byOwner[owner] = { count: 0, amount: 0 }
              byOwner[owner].count  += 1
              byOwner[owner].amount += d.amount
            })
            const ownerData = Object.entries(byOwner)
              .map(([name, v]) => ({ name, count: v.count, amount: v.amount }))
              .sort((a, b) => b.count - a.count)

            return ownerData.length > 0 ? (
              <>
                <div className="card">
                  <div className="card-head" style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      ● Leads por Vendedor
                    </span>
                  </div>
                  <div style={{ padding: '16px 8px 8px' }}>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={ownerData} margin={{ top: 20, right: 20, left: 0, bottom: 40 }}>
                        <CartesianGrid vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-active)' }} formatter={(v: number) => [v, 'Deals']} />
                        <Bar dataKey="count" name="Deals" radius={[4, 4, 0, 0]} maxBarSize={56} fill="#38bdf8">
                          <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 600, fill: 'var(--text)' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="card-head" style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      ● Inversión por Vendedor
                    </span>
                  </div>
                  <div style={{ padding: '16px 8px 8px' }}>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={[...ownerData].sort((a,b) => b.amount - a.amount)} margin={{ top: 20, right: 20, left: 0, bottom: 40 }}>
                        <CartesianGrid vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" interval={0} />
                        <YAxis tickFormatter={v => formatAmount(Number(v))} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-active)' }} formatter={(v: any) => [formatAmount(Number(v)), 'Inversión']} />
                        <Bar dataKey="amount" name="Inversión" radius={[4, 4, 0, 0]} maxBarSize={56} fill="#34d399">
                          <LabelList dataKey="amount" position="top" formatter={(v: any) => formatAmount(Number(v))} style={{ fontSize: 10, fontWeight: 600, fill: 'var(--text)' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : null
          })()}

          {/* Leads por Rubro + Inversión por Rubro */}
          {(() => {
            // Rubro = first tag of the deal's contact, fallback 'Otros'
            const byRubroCount:  Record<string, number> = {}
            const byRubroAmount: Record<string, number> = {}
            deals.forEach(d => {
              const rubro = (d.contact as any)?.rubro as string | undefined
              const label = rubro || 'Otros'
              byRubroCount[label]  = (byRubroCount[label]  || 0) + 1
              byRubroAmount[label] = (byRubroAmount[label] || 0) + d.amount
            })

            const rubroCount = Object.entries(byRubroCount)
              .map(([name, value]) => ({ name, value }))
              .sort((a, b) => a.value - b.value)

            const rubroAmount = Object.entries(byRubroAmount)
              .map(([name, amount]) => ({ name, amount }))
              .filter(r => r.amount > 0)
              .sort((a, b) => a.amount - b.amount)

            if (rubroCount.length === 0) return null

            return (
              <>
                <div className="card">
                  <div className="card-head" style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      ● Leads por Rubro
                    </span>
                  </div>
                  <div style={{ padding: '16px 0 8px' }}>
                    <ResponsiveContainer width="100%" height={Math.max(260, rubroCount.length * 40)}>
                      <BarChart data={rubroCount} layout="vertical" margin={{ top: 0, right: 48, left: 10, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="var(--border)" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" width={140}
                          tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 500 }}
                          axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-active)' }} formatter={(v: number) => [v, 'Leads']} />
                        <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]} maxBarSize={26} fill="#818cf8">
                          <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 600, fill: 'var(--text)' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="card-head" style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      ● Inversión Estimada por Rubro
                    </span>
                  </div>
                  <div style={{ padding: '16px 0 8px' }}>
                    <ResponsiveContainer width="100%" height={Math.max(260, rubroAmount.length * 40)}>
                      <BarChart data={rubroAmount} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 16 }}>
                        <CartesianGrid horizontal={false} stroke="var(--border)" />
                        <XAxis type="number"
                          tickFormatter={v => formatAmount(Number(v))}
                          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                          axisLine={false} tickLine={false} angle={-35} textAnchor="end" height={48} />
                        <YAxis dataKey="name" type="category" width={140}
                          tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 500 }}
                          axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-active)' }}
                          formatter={(v: any) => [formatAmount(Number(v)), 'Inversión']} />
                        <Bar dataKey="amount" name="Inversión" radius={[0, 4, 4, 0]} maxBarSize={26} fill="#38bdf8">
                          <LabelList dataKey="amount" position="right"
                            formatter={(v: any) => formatAmount(Number(v))}
                            style={{ fontSize: 10, fontWeight: 600, fill: 'var(--text)' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )
          })()}

          {/* Summary row */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-head"><h3>Resumen financiero</h3></div>
            <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0 }}>
              {[
                { label: 'Deals ganados',    val: `${won.length}`,  sub: formatAmount(totalWon),                                              color: 'var(--success)' },
                { label: 'Deals perdidos',   val: `${lost.length}`, sub: formatAmount(lost.reduce((s,d)=>s+d.amount,0)),                      color: 'var(--danger)'  },
                { label: 'En progreso',      val: `${open.length}`, sub: formatAmount(totalOpen),                                             color: 'var(--accent)'  },
                { label: 'Prob. ponderada',  val: formatAmount(open.reduce((s,d)=>s+d.amount*(d.probability/100),0)), sub: 'forecast',        color: 'var(--info)'    },
              ].map((r, i) => (
                <div key={r.label} style={{ padding: '14px 20px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>{r.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: r.color }}>{r.val}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CONTACTOS TAB ── */}
      {tab === 'contactos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card">
            <div className="card-head"><h3>Contactos por estado</h3></div>
            <div style={{ padding: '16px 0' }}>
              {statusCounts.length === 0
                ? <div className="empty"><p>Sin contactos.</p></div>
                : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={statusCounts}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statusCounts.map((entry, i) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )
              }
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Top contactos por valor</h3></div>
            <div>
              {[...contacts].sort((a, b) => b.value - a.value).slice(0, 8).map((c, i) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)', fontSize: 11, width: 16 }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.company}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatAmount(c.value)}</span>
                </div>
              ))}
              {contacts.length === 0 && <div className="empty"><p>Sin contactos.</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* ── PIPELINE TABLE TAB ── */}
      {tab === 'pipeline' && (
        <div className="card">
          <div className="card-head"><h3>Todos los deals</h3></div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Deal</th>
                <th>Etapa</th>
                <th>Monto</th>
                <th>Probabilidad</th>
                <th>Owner</th>
                <th>Cierre</th>
              </tr>
            </thead>
            <tbody>
              {deals.map(d => (
                <tr key={d.id}>
                  <td className="cell-strong">{d.title}</td>
                  <td><span className="pill">{getLabel(d.stage_id)}</span></td>
                  <td className="cell-mono">{formatAmount(d.amount)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="bar" style={{ width: 60 }}>
                        <span style={{ width: `${d.probability}%` }} />
                      </div>
                      <span className="cell-mono">{d.probability}%</span>
                    </div>
                  </td>
                  <td className="cell-muted">{d.owner_name || '—'}</td>
                  <td className="cell-muted">{d.close_date ? new Date(d.close_date).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {deals.length === 0 && <div className="empty"><p>Sin deals.</p></div>}
        </div>
      )}
    </div>
  )
}
