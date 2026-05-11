'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Contact, Deal, Task, Activity } from '@/lib/types'
import type { VendorStat } from '@/app/(app)/dashboard/page'
import { useCurrency } from '@/lib/useCurrency'
import Icon from '@/components/ui/Icon'
import Sparkline from '@/components/ui/Sparkline'
import { PriorityPill } from '@/components/ui/Pill'
import RevenueChart from './RevenueChart'

const ACTIVITY_ICONS: Record<string, string> = {
  email_in: 'mail', email_out: 'send', call_out: 'phone',
  meeting: 'meet', note: 'edit', invoice: 'card', stage_change: 'pipeline',
}

interface Props {
  userId: string
  currentUserId: string
  userName: string
  isOwner: boolean
  vendorName: string | null
  teamStats: VendorStat[]
  initialContacts: Contact[]
  initialDeals: Deal[]
  initialTasks: Task[]
  initialActivities: Activity[]
}

type Period = 'week' | 'month' | 'year'

const PERIOD_LABELS: Record<Period, string> = {
  week:  'Última semana',
  month: 'Este mes',
  year:  'Este año',
}

function getPeriodStart(p: Period): Date {
  const now = new Date()
  if (p === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 7); return d }
  if (p === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
  return new Date(now.getFullYear(), 0, 1)
}

export default function DashboardClient({
  userId, currentUserId, userName, isOwner, vendorName, teamStats,
  initialContacts, initialDeals, initialTasks, initialActivities,
}: Props) {
  const [contacts,   setContacts]   = useState(initialContacts)
  const [deals,      setDeals]      = useState(initialDeals)
  const [tasks,      setTasks]      = useState(initialTasks)
  const [activities, setActivities] = useState(initialActivities)
  const [period,     setPeriod]     = useState<Period>('month')
  const supabase = createClient()
  const { formatAmount } = useCurrency()

  useEffect(() => {
    const fetchAll = () => {
      supabase.from('contacts').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        .then(({ data }) => data && setContacts(data as Contact[]))
      supabase.from('deals').select('*, contact:contacts(id,name,company)').eq('user_id', userId)
        .then(({ data }) => data && setDeals(data as Deal[]))
      supabase.from('tasks').select('*, contact:contacts(id,name,company)').eq('user_id', userId).order('created_at', { ascending: false })
        .then(({ data }) => data && setTasks(data as Task[]))
      supabase.from('activities').select('*, contact:contacts(id,name,company)').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
        .then(({ data }) => data && setActivities(data as Activity[]))
    }

    // Realtime works for owner; vendors fall back to polling (RLS blocks vendor realtime)
    const ch = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts',   filter: `user_id=eq.${userId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals',      filter: `user_id=eq.${userId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks',      filter: `user_id=eq.${userId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities', filter: `user_id=eq.${userId}` }, fetchAll)
      .subscribe()

    const timer = setInterval(fetchAll, 30_000)
    return () => { supabase.removeChannel(ch); clearInterval(timer) }
  }, [userId])

  const periodStart      = getPeriodStart(period)
  const inPeriod         = (date: string) => new Date(date) >= periodStart
  const filteredDeals    = deals.filter(d => inPeriod(d.created_at))
  const filteredContacts = contacts.filter(c => inPeriod(c.created_at))

  const openDeals      = filteredDeals.filter(d => d.stage_id !== 'ganado' && d.stage_id !== 'perdido')
  const wonDeals       = filteredDeals.filter(d => d.stage_id === 'ganado')
  const lostDeals      = filteredDeals.filter(d => d.stage_id === 'perdido')
  const totalPipeline  = openDeals.reduce((s, d) => s + d.amount, 0)
  const totalWon       = wonDeals.reduce((s, d) => s + d.amount, 0)
  const totalInvestment = filteredDeals.reduce((s, d) => s + d.amount, 0)
  const closeRate      = filteredDeals.length > 0 ? Math.round((wonDeals.length / filteredDeals.length) * 100) : 0
  const lossRate       = filteredDeals.length > 0 ? Math.round((lostDeals.length / filteredDeals.length) * 100) : 0
  const activeLeads    = filteredContacts.filter(c => c.status !== 'cliente' && c.status !== 'archivado')

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)
  const openTasks  = tasks.filter(t => {
    if (t.done) return false
    if (!t.due_date) return false
    const d = new Date(t.due_date)
    return d >= todayStart && d <= todayEnd
  })

  // Leads/deals personales — funciona para owner y vendor
  const myContacts  = contacts.filter(c => c.assigned_to === currentUserId)
  const myOpenDeals = isOwner
    ? deals.filter(d => d.stage_id !== 'ganado' && d.stage_id !== 'perdido' && myContacts.some(c => c.id === d.contact_id))
    : openDeals
  const myPipeline  = myOpenDeals.reduce((s, d) => s + d.amount, 0)

  const displayName = isOwner ? userName.split(' ')[0] : (vendorName?.split(' ')[0] ?? userName.split(' ')[0])

  return (
    <div className="page">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1>Buenos días, {displayName}</h1>
            {!isOwner && (
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                textTransform: 'uppercase', padding: '2px 8px',
                background: 'var(--accent-soft)', color: 'var(--accent)',
                borderRadius: 6, border: '1px solid var(--accent)',
              }}>
                Tus asignaciones
              </span>
            )}
            {isOwner && (
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                textTransform: 'uppercase', padding: '2px 8px',
                background: 'var(--success-soft, oklch(95% 0.04 145))', color: 'var(--success)',
                borderRadius: 6, border: '1px solid var(--success)',
              }}>
                Owner · Vista completa
              </span>
            )}
          </div>
          <p>
            {isOwner ? (
              <>
                Workspace completo · <b style={{ color: 'var(--text)' }}>{contacts.length} contactos</b>
                {' · '}{deals.length} deals · {openTasks.length} tareas hoy
              </>
            ) : (
              <>
                <b style={{ color: 'var(--text)' }}>{openTasks.length} tareas pendientes hoy</b>
                {' · '}{contacts.length} leads asignados
                {' · '}{openDeals.length} deals activos
              </>
            )}
          </p>
        </div>
        <div className="page-actions">
          {(['week', 'month', 'year'] as Period[]).map(p => (
            <button key={p} className={`btn sm ${period === p ? 'primary' : ''}`} onClick={() => setPeriod(p)}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI fila 1 ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 12 }}>
        <StatTile lbl="Inversión estimada"    val={formatAmount(totalInvestment)} delta={`${filteredDeals.length} deals`}      up color="oklch(70% 0.13 75)" data={[10,15,20,28,35,42,50,58,64]} />
        <StatTile lbl="Inversión ganada"      val={formatAmount(totalWon)}        delta={`${wonDeals.length} cerrados`}         up color="oklch(62% 0.14 145)" data={[0,2,4,6,8,12,18,24,wonDeals.length*10]} />
        <StatTile lbl={`Ganado · ${PERIOD_LABELS[period].toLowerCase()}`} val={formatAmount(totalWon)} delta={`${wonDeals.length} cerrados`} up color="oklch(58% 0.13 155)" data={[12,18,15,22,28,32,38,40,48]} />
        <StatTile lbl="Tasa de cierre"        val={`${closeRate}%`}               delta={`${filteredDeals.length} totales`}     up color="oklch(65% 0.13 230)" data={[24,28,30,32,34,36,38,36,38]} />
        <StatTile lbl="Tasa de pérdida"       val={`${lossRate}%`}                delta={`${lostDeals.length} perdidos`}        up={lossRate===0} color="oklch(60% 0.14 25)" data={[0,1,2,2,3,3,2,2,lostDeals.length]} />
      </div>

      {/* ── KPI fila 2 ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatTile lbl="Total de leads"   val={filteredContacts.length.toString()} delta="todos los estados" up color="oklch(65% 0.10 250)" data={[8,12,14,18,22,26,30,35,filteredContacts.length]} />
        <StatTile lbl="Leads activos"    val={activeLeads.length.toString()}      delta={`${filteredContacts.length - activeLeads.length} inactivos`} up color="oklch(68% 0.13 200)" data={[6,10,12,16,18,22,26,30,activeLeads.length]} />
        <StatTile lbl="Ganados"          val={wonDeals.length.toString()}          delta={`${lostDeals.length} perdidos`} up color="oklch(58% 0.15 155)" data={[0,1,1,2,2,3,3,4,wonDeals.length]} />
        <StatTile lbl="Perdidos"         val={lostDeals.length.toString()}         delta={`de ${filteredDeals.length} totales`} up={lostDeals.length===0} color="oklch(60% 0.14 25)" data={[0,0,1,1,1,2,2,2,lostDeals.length]} />
        <StatTile lbl="Nuevos contactos" val={filteredContacts.length.toString()} delta={`${filteredContacts.filter(c=>c.status==='cliente').length} clientes`} up color="oklch(70% 0.13 75)" data={[5,8,10,12,15,16,18,20,filteredContacts.length]} />
      </div>

      {/* ── Mis Leads Interesados + Deals Activos (owner con asignados + todos los vendors) */}
      {(!isOwner || myContacts.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

          {/* Leads asignados */}
          <div className="card">
            <div className="card-head">
              <div>
                <h3>Mis leads</h3>
                <div className="sub">
                  {myContacts.length} asignados
                  {' · '}{myContacts.filter(c => c.status === 'interesado' || c.status === 'oportunidad').length} activos
                </div>
              </div>
              <a href="/contacts">
                <button className="btn ghost sm">Ver todos <Icon name="chev_right" size={12} /></button>
              </a>
            </div>
            <div>
              {myContacts.slice(0, 6).map((c, i, arr) => {
                const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
                  interesado:  { bg: 'oklch(95% 0.04 230)', color: 'var(--info)',    border: 'var(--info)',    label: 'Interesado'  },
                  oportunidad: { bg: 'var(--accent-soft)',  color: 'var(--accent)', border: 'var(--accent)', label: 'Oportunidad' },
                  cliente:     { bg: 'oklch(95% 0.04 145)', color: 'var(--success)', border: 'var(--success)', label: 'Cliente'    },
                  enviado:     { bg: 'oklch(97% 0.05 80)',  color: 'var(--warning)', border: 'var(--warning)', label: 'Enviado'    },
                  contactado:  { bg: 'var(--bg-sunken)',    color: 'var(--text-muted)', border: 'var(--border)', label: 'Contactado' },
                  archivado:   { bg: 'var(--bg-sunken)',    color: 'var(--text-subtle)', border: 'var(--border)', label: 'Archivado' },
                }
                const s = STATUS_STYLE[c.status] ?? { bg: 'var(--bg-sunken)', color: 'var(--text-muted)', border: 'var(--border)', label: c.status ?? 'Lead' }
                return (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'var(--accent-soft)', color: 'var(--accent)',
                      display: 'grid', placeItems: 'center',
                      fontSize: 11, fontWeight: 600, flexShrink: 0,
                    }}>
                      {c.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {c.company || '—'}{c.rubro ? ` · ${c.rubro}` : ''}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                    }}>
                      {s.label}
                    </span>
                  </div>
                )
              })}
              {myContacts.length === 0 && (
                <div className="empty" style={{ padding: '28px 24px' }}><p>Sin leads asignados aún</p></div>
              )}
            </div>
          </div>

          {/* Deals activos */}
          <div className="card">
            <div className="card-head">
              <div>
                <h3>Mis deals activos</h3>
                <div className="sub">{myOpenDeals.length} deals · {formatAmount(myPipeline)}</div>
              </div>
              <a href="/pipeline">
                <button className="btn ghost sm">Pipeline <Icon name="chev_right" size={12} /></button>
              </a>
            </div>
            <div>
              {myOpenDeals.slice(0, 6).map((d, i, arr) => (
                <div key={d.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {(d.contact as any)?.company || (d.contact as any)?.name || '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>
                      {formatAmount(d.amount)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {d.stage_id?.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
              ))}
              {myOpenDeals.length === 0 && (
                <div className="empty" style={{ padding: '28px 24px' }}>
                  <p>Sin deals activos · <a href="/pipeline" style={{ color: 'var(--accent)' }}>Crear deal</a></p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Team performance (owner only) ─────────────────────────────────── */}
      {isOwner && teamStats.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <div>
              <h3>Rendimiento del equipo</h3>
              <div className="sub">{teamStats.length} vendedores activos</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(teamStats.length, 4)}, 1fr)`, gap: 1, borderTop: '1px solid var(--border)' }}>
            {teamStats.map((v, i) => (
              <div
                key={v.member_user_id}
                style={{
                  padding: '16px 20px',
                  borderRight: i < teamStats.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    display: 'grid', placeItems: 'center',
                    fontSize: 12, fontWeight: 600,
                  }}>
                    {v.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Vendedor</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <VendorKpi label="Leads" value={v.leads.toString()} color="var(--info)" />
                  <VendorKpi label="Deals activos" value={v.active_deals.toString()} color="var(--accent)" />
                  <VendorKpi label="Pipeline" value={formatAmount(v.pipeline)} color="oklch(70% 0.13 75)" />
                  <VendorKpi label="Ganados" value={v.won.toString()} color="var(--success)" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Pipeline por etapa</h3>
              <div className="sub">{openDeals.length} deals · {formatAmount(totalPipeline)} · {PERIOD_LABELS[period].toLowerCase()}</div>
            </div>
          </div>
          <div style={{ padding: '18px 20px 22px' }}>
            <RevenueChart deals={filteredDeals} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Estado de contactos</h3>
            <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{PERIOD_LABELS[period].toLowerCase()}</span>
          </div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Clientes',       keys: ['cliente'],                                     color: 'var(--success)' },
              { label: 'Oportunidades',  keys: ['oportunidad'],                                 color: 'var(--accent)' },
              { label: 'Interesados',    keys: ['interesado'],                                  color: 'var(--info)' },
              { label: 'Leads',          keys: ['lead', 'contactar', 'no_enviado', 'contactado'], color: 'oklch(65% 0.08 230)' },
              { label: 'Enviados',        keys: ['enviado'],                                             color: 'var(--warning)' },
              { label: 'Archivados',     keys: ['archivado'],                                   color: 'var(--text-subtle)' },
            ].map(s => {
              const count = filteredContacts.filter(c => s.keys.includes(c.status)).length
              const pct   = filteredContacts.length > 0 ? Math.round((count / filteredContacts.length) * 100) : 0
              return (
                <div key={s.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span>{s.label}</span>
                    <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{count} · {pct}%</span>
                  </div>
                  <div className="bar"><span style={{ width: `${pct * 2}%`, background: s.color }} /></div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Tasks + Activity ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card">
          <div className="card-head">
            <h3>Tareas de hoy</h3>
            <a href="/tasks">
              <button className="btn ghost sm">Ver todas <Icon name="chev_right" size={12} /></button>
            </a>
          </div>
          <div>
            {openTasks.slice(0, 5).map((t, i) => (
              <TaskRow key={t.id} task={t} divider={i < 4} onToggle={async id => {
                await supabase.from('tasks').update({ done: true }).eq('id', id)
                setTasks(ts => ts.map(x => x.id === id ? { ...x, done: true } : x))
              }} />
            ))}
            {openTasks.length === 0 && (
              <div className="empty" style={{ padding: '32px 24px' }}><p>Sin tareas para hoy 🎉</p></div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Actividad reciente</h3>
            <button className="btn ghost sm icon"><Icon name="more" size={14} /></button>
          </div>
          <div style={{ padding: '8px 0' }}>
            {activities.slice(0, 6).map(a => <ActivityRow key={a.id} activity={a} />)}
            {activities.length === 0 && (
              <div className="empty" style={{ padding: '32px 24px' }}><p>Sin actividad registrada</p></div>
            )}
          </div>
        </div>
      </div>

      {/* ── AI brief capsule ──────────────────────────────────────────────── */}
      <div className="card" style={{ marginTop: 12, background: 'linear-gradient(135deg, var(--accent-soft), transparent 70%)', borderColor: 'transparent' }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="sparkles" size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Brief assistant</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {isOwner
                ? <>Workspace: {contacts.length} contactos · {deals.filter(d => d.stage_id === 'prop_enviada').length} propuestas enviadas sin respuesta · {contacts.filter(c => !c.assigned_to).length} leads sin asignar.</>
                : <>Tenés {deals.filter(d => d.stage_id === 'prop_enviada').length} propuestas enviadas sin respuesta. {contacts.filter(c => c.status === 'oportunidad').length > 0 && ` Hay ${contacts.filter(c => c.status === 'oportunidad').length} oportunidades abiertas para avanzar.`}</>
              }
            </div>
          </div>
          <button className="btn sm">Descartar</button>
          <button className="btn primary sm">{isOwner ? 'Ver equipo' : 'Ver oportunidades'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatTile({ lbl, val, delta, up, data, color }: {
  lbl: string; val: string; delta: string; up: boolean; data: number[]; color?: string
}) {
  return (
    <div className="card stat">
      <div className="lbl">{lbl}</div>
      <div className="val">{val}</div>
      <div className={`delta ${up ? 'up' : 'down'}`}>
        <Icon name={up ? 'arrow_up' : 'arrow_dn'} size={11} /> {delta}
      </div>
      <div className="spark">
        <Sparkline data={data} color={color || 'var(--accent)'} width={210} />
      </div>
    </div>
  )
}

function VendorKpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-sunken)', borderRadius: 6, padding: '7px 10px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color }}>{value}</div>
    </div>
  )
}

function TaskRow({ task, divider, onToggle }: { task: Task; divider: boolean; onToggle: (id: string) => void }) {
  const [done, setDone] = useState(task.done)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: divider ? '1px solid var(--border)' : 'none' }}>
      <span className={`chk ${done ? 'on' : ''}`} onClick={() => { setDone(true); onToggle(task.id) }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 450, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-muted)' : 'var(--text)' }}>
          {task.title}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="clock" size={11} /> {task.due_label || '—'}
          {task.contact && <><span style={{ color: 'var(--border-strong)' }}>·</span> {(task.contact as any).company}</>}
        </div>
      </div>
      <PriorityPill priority={task.priority} />
    </div>
  )
}

function ActivityRow({ activity }: { activity: Activity }) {
  const ico     = ACTIVITY_ICONS[activity.kind] || 'doc'
  const contact = activity.contact as any
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 18px', alignItems: 'flex-start' }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
        <Icon name={ico} size={13} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text)' }}>
          <b style={{ fontWeight: 500 }}>{activity.who || 'Sistema'}</b>
          {contact && <span style={{ color: 'var(--text-muted)' }}> · {contact.company || contact.name}</span>}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{activity.body}</div>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 3 }}>
          {new Date(activity.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
