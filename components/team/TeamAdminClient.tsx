'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TeamMember, Deal } from '@/lib/types'
import { formatCurrency } from '@/lib/types'
import Icon from '@/components/ui/Icon'
import Avatar from '@/components/ui/Avatar'

type Tab = 'miembros' | 'cuotas' | 'forecast' | 'roles' | 'auditoria'


const PERM_LABELS: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', vendedor: 'Vendedor', sdr: 'SDR', viewer: 'Viewer',
}
const PERM_COLORS: Record<string, string> = {
  admin: 'danger', manager: 'accent', vendedor: 'success', sdr: 'info', viewer: '',
}
const STATUS_COLORS: Record<string, string> = {
  activo: 'success', inactivo: '', invitado: 'warning',
}

interface Props {
  members: TeamMember[]
  deals: Deal[]
  userId: string
  isOwner: boolean
}

export default function TeamAdminClient({ members: init, deals, userId, isOwner }: Props) {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('miembros')
  const [members, setMembers] = useState(init)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [invitePerm, setInvitePerm] = useState<'vendedor' | 'sdr' | 'manager' | 'viewer'>('vendedor')
  const [saving, setSaving] = useState(false)

  async function addMember() {
    if (!inviteName.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('team_members').insert({
      owner_id: userId,
      name: inviteName.trim(),
      email: inviteEmail.trim() || null,
      phone: invitePhone.trim() || null,
      role: inviteRole.trim() || 'Vendedor',
      permission: invitePerm,
      tone: 'accent',
      status: inviteEmail.trim() ? 'invitado' : 'activo',
      quota: 0, sold: 0, deals_count: 0, win_rate: 0,
    }).select().single()

    // Send email invite so vendor can log in
    if (!error && inviteEmail.trim()) {
      await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
    }

    setSaving(false)
    if (!error && data) {
      setMembers(m => [...m, data as TeamMember])
      setShowInvite(false)
      setInviteName('')
      setInviteEmail('')
      setInvitePhone('')
      setInviteRole('')
    }
  }

  async function removeMember(id: string) {
    if (!confirm('¿Eliminar miembro del equipo?')) return
    await supabase.from('team_members').delete().eq('id', id)
    setMembers(m => m.filter(x => x.id !== id))
  }

  // Forecast: group deals by owner_name
  const ownerNames = Array.from(new Set(deals.map(d => d.owner_name || 'Sin asignar')))
  const forecastByOwner = ownerNames.map(owner => {
    const ownerDeals = deals.filter(d => (d.owner_name || 'Sin asignar') === owner)
    const won   = ownerDeals.filter(d => d.stage_id === 'ganado')
    const open  = ownerDeals.filter(d => d.stage_id !== 'ganado' && d.stage_id !== 'perdido')
    const weighted = open.reduce((s, d) => s + d.amount * (d.probability / 100), 0)
    return { owner, total: ownerDeals.length, won: won.length, open: open.length, weighted, wonAmount: won.reduce((s,d)=>s+d.amount,0) }
  })

  const totalQuota = members.reduce((s, m) => s + m.quota, 0)
  const totalSold  = members.reduce((s, m) => s + m.sold, 0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Equipo</h1>
          <p>{members.length} miembro{members.length !== 1 ? 's' : ''}</p>
        </div>
        {isOwner && (
          <div className="page-actions">
            <button className="btn primary" onClick={() => setShowInvite(true)}>
              <Icon name="user_plus" size={13} /> Invitar miembro
            </button>
          </div>
        )}
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {(['miembros', 'cuotas', 'forecast', 'roles', 'auditoria'] as Tab[]).map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'miembros' && (
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th>Miembro</th>
                <th>Teléfono</th>
                <th>Rol</th>
                <th>Permiso</th>
                <th>Estado</th>
                <th>Deals</th>
                <th>Win rate</th>
                <th>Cuota</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={m.name} tone={m.tone as any} size="sm" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                        {m.email && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{m.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="cell-muted">{m.phone || '—'}</td>
                  <td className="cell-muted">{m.role}</td>
                  <td><span className={`pill ${PERM_COLORS[m.permission] || ''}`}>{PERM_LABELS[m.permission]}</span></td>
                  <td><span className={`pill ${STATUS_COLORS[m.status] || ''}`}>{m.status}</span></td>
                  <td className="cell-mono">{m.deals_count}</td>
                  <td className="cell-mono">{m.win_rate}%</td>
                  <td className="cell-mono">{formatCurrency(m.quota)}</td>
                  <td>
                    <button className="btn ghost sm icon" onClick={() => removeMember(m.id)}>
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {members.length === 0 && <div className="empty"><p>Sin miembros. Invitá al equipo.</p></div>}
        </div>
      )}

      {tab === 'cuotas' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card">
            <div className="card-head"><h3>Cuotas del equipo</h3></div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {members.map(m => {
                const pct = m.quota > 0 ? Math.min(Math.round((m.sold / m.quota) * 100), 100) : 0
                return (
                  <div key={m.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Avatar name={m.name} tone={m.tone as any} size="sm" />
                        <span style={{ fontWeight: 500 }}>{m.name}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {formatCurrency(m.sold)} / {formatCurrency(m.quota)}
                      </span>
                    </div>
                    <div className="bar" style={{ height: 8 }}>
                      <span style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : pct >= 60 ? 'var(--accent)' : 'var(--warning)' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{pct}% completado</div>
                  </div>
                )
              })}
              {members.length === 0 && <div className="empty" style={{ padding: '16px 0' }}><p>Sin datos.</p></div>}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Resumen</h3></div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Cuota total del equipo', val: formatCurrency(totalQuota) },
                { label: 'Vendido acumulado', val: formatCurrency(totalSold) },
                { label: 'Avance total', val: totalQuota > 0 ? `${Math.round((totalSold/totalQuota)*100)}%` : '—' },
                { label: 'Miembros activos', val: members.filter(m => m.status === 'activo').length.toString() },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                  <span style={{ fontWeight: 500 }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'forecast' && (
        <div className="card">
          <div className="card-head"><h3>Forecast por vendedor</h3></div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Total deals</th>
                <th>Ganados</th>
                <th>En progreso</th>
                <th>Ganado $</th>
                <th>Ponderado</th>
              </tr>
            </thead>
            <tbody>
              {forecastByOwner.map(f => (
                <tr key={f.owner}>
                  <td style={{ fontWeight: 500 }}>{f.owner}</td>
                  <td className="cell-mono">{f.total}</td>
                  <td><span style={{ color: 'var(--success)', fontWeight: 500 }}>{f.won}</span></td>
                  <td className="cell-mono">{f.open}</td>
                  <td className="cell-mono">{formatCurrency(f.wonAmount)}</td>
                  <td className="cell-mono" style={{ color: 'var(--accent)' }}>{formatCurrency(f.weighted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {deals.length === 0 && <div className="empty"><p>Sin deals aún.</p></div>}
        </div>
      )}

      {tab === 'roles' && (
        <div className="card">
          <div className="card-head"><h3>Roles y permisos</h3></div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { role: 'Admin',    desc: 'Acceso completo: configuración, equipo, billing, eliminar datos.',     color: 'danger' },
              { role: 'Manager',  desc: 'Gestión de equipo y reportes. No puede modificar configuración.',       color: 'accent' },
              { role: 'Vendedor', desc: 'CRUD de contactos, deals y tareas propios. Sin acceso a billing.',      color: 'success' },
              { role: 'SDR',      desc: 'Solo puede crear contactos y deals en las etapas iniciales.',           color: 'info' },
              { role: 'Viewer',   desc: 'Solo lectura. No puede crear ni modificar ningún registro.',            color: '' },
            ].map(r => (
              <div key={r.role} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                <span className={`pill ${r.color}`} style={{ flexShrink: 0, marginTop: 1 }}>{r.role}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'auditoria' && (
        <div className="card">
          <div className="card-head"><h3>Auditoría de accesos</h3></div>
          <div className="empty" style={{ padding: '40px 0' }}>
            <Icon name="doc" size={28} />
            <p style={{ marginTop: 8 }}>Los logs de auditoría estarán disponibles próximamente.</p>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 420 }}>
            <div className="modal-head">
              <h2>Invitar miembro</h2>
              <button className="btn ghost icon" onClick={() => setShowInvite(false)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label className="lbl">Nombre *</label>
                <input className="input" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Ana García" autoFocus />
              </div>
              <div className="field">
                <label className="lbl">Email</label>
                <input className="input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="ana@empresa.com" />
              </div>
              <div className="field">
                <label className="lbl">Teléfono</label>
                <input className="input" type="tel" value={invitePhone} onChange={e => setInvitePhone(e.target.value)} placeholder="+54 9 11 1234-5678" />
              </div>
              <div className="field">
                <label className="lbl">Rol</label>
                <input className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value)} placeholder="Ej: Account Executive" />
              </div>
              <div className="field">
                <label className="lbl">Permiso</label>
                <select className="input" value={invitePerm} onChange={e => setInvitePerm(e.target.value as any)}>
                  <option value="vendedor">Vendedor</option>
                  <option value="sdr">SDR</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowInvite(false)}>Cancelar</button>
              <button className="btn primary" onClick={addMember} disabled={!inviteName.trim() || saving}>
                {saving ? 'Guardando…' : 'Agregar miembro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
