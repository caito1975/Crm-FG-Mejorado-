'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PipelineStage } from '@/lib/types'
import Icon from '@/components/ui/Icon'

type Tab = 'workspace' | 'etapas' | 'integraciones' | 'billing' | 'api' | 'cuenta'
type Theme = 'Claro' | 'Oscuro' | 'Sistema'
type Density = 'Compacta' | 'Normal' | 'Cómoda'
type Currency = 'ARS' | 'USD' | 'EUR'

interface Props {
  userId: string      // workspaceId — para stages y datos compartidos
  authUserId: string  // auth user real — para integraciones personales
  userEmail: string
  stages: PipelineStage[]
}

function applyTheme(t: Theme) {
  if (t === 'Oscuro') {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else if (t === 'Claro') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    dark ? document.documentElement.setAttribute('data-theme', 'dark') : document.documentElement.removeAttribute('data-theme')
  }
}

function applyDensity(d: Density) {
  document.documentElement.removeAttribute('data-density')
  if (d === 'Compacta') document.documentElement.setAttribute('data-density', 'compact')
  if (d === 'Cómoda')   document.documentElement.setAttribute('data-density', 'cozy')
}

interface Integration {
  provider: string
  email: string | null
}

export default function SettingsClient({ userId, authUserId, userEmail, stages: initStages }: Props) {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('workspace')
  const [stages, setStages] = useState(initStages)
  const [newStageLabel, setNewStageLabel] = useState('')
  const [newStageColor, setNewStageColor] = useState('oklch(65% 0.11 250)')
  const [saved, setSaved] = useState(false)
  const [theme, setTheme]       = useState<Theme>('Sistema')
  const [density, setDensity]   = useState<Density>('Normal')
  const [currency, setCurrency] = useState<Currency>('ARS')
  const [connections, setConnections] = useState<Record<string, Integration>>({})
  const [syncing, setSyncing]   = useState<string | null>(null)
  const [syncMsg, setSyncMsg]   = useState<Record<string, string>>({})
  const [pwForm, setPwForm]     = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg]       = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    const savedTheme    = (localStorage.getItem('crm-theme')     as Theme)    || 'Sistema'
    const savedDensity  = (localStorage.getItem('crm-density')   as Density)  || 'Normal'
    const savedCurrency = (localStorage.getItem('crm-currency')  as Currency) || 'ARS'
    setTheme(savedTheme)
    setDensity(savedDensity)
    setCurrency(savedCurrency)
    applyTheme(savedTheme)
    applyDensity(savedDensity)

    // Load connected integrations (personal — usa authUserId)
    supabase.from('integrations').select('provider,email').eq('user_id', authUserId)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, Integration> = {}
          data.forEach(i => { map[i.provider] = { provider: i.provider, email: i.email } })
          setConnections(map)
        }
      })

    // Handle redirect back from Google OAuth
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const tabParam  = params.get('tab') as Tab | null
    if (tabParam) setTab(tabParam)
    if (connected) {
      // Refresh integrations after connect
      supabase.from('integrations').select('provider,email').eq('user_id', userId)
        .then(({ data }) => {
          if (data) {
            const map: Record<string, Integration> = {}
            data.forEach(i => { map[i.provider] = { provider: i.provider, email: i.email } })
            setConnections(map)
          }
        })
      // Clean URL
      window.history.replaceState({}, '', '/settings?tab=integraciones')
    }
  }, [])

  function changeTheme(t: Theme) {
    setTheme(t)
    localStorage.setItem('crm-theme', t)
    applyTheme(t)
  }

  function changeDensity(d: Density) {
    setDensity(d)
    localStorage.setItem('crm-density', d)
    applyDensity(d)
  }

  function changeCurrency(c: Currency) {
    setCurrency(c)
    localStorage.setItem('crm-currency', c)
  }

  async function addStage() {
    if (!newStageLabel.trim()) return
    const position = stages.length
    const id = newStageLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const { data, error } = await supabase.from('pipeline_stages').insert({
      id, user_id: userId, label: newStageLabel.trim(), color: newStageColor, position,
    }).select().single()
    if (!error && data) {
      setStages(s => [...s, data as PipelineStage])
      setNewStageLabel('')
    }
  }

  async function removeStage(id: string) {
    if (!confirm('¿Eliminar esta etapa? Los deals en ella quedarán sin etapa.')) return
    await supabase.from('pipeline_stages').delete().eq('id', id).eq('user_id', userId)
    setStages(s => s.filter(x => x.id !== id))
  }

  function flash() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleConnect(provider: string) {
    window.location.href = `/api/integrations/google/connect?provider=${provider}`
  }

  async function handleDisconnect(provider: string) {
    if (!confirm('¿Desconectar esta integración?')) return
    await supabase.from('integrations').delete().eq('user_id', authUserId).eq('provider', provider)
    setConnections(c => { const n = { ...c }; delete n[provider]; return n })
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ text: 'Las contraseñas nuevas no coinciden', ok: false })
      return
    }
    if (pwForm.next.length < 6) {
      setPwMsg({ text: 'La contraseña debe tener al menos 6 caracteres', ok: false })
      return
    }
    setPwSaving(true)
    setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })
    if (error) {
      setPwMsg({ text: error.message, ok: false })
    } else {
      setPwMsg({ text: 'Contraseña actualizada correctamente', ok: true })
      setPwForm({ current: '', next: '', confirm: '' })
    }
    setPwSaving(false)
  }

  async function handleSync(provider: string) {
    setSyncing(provider)
    setSyncMsg(m => ({ ...m, [provider]: '' }))
    const endpoint = provider === 'gmail'
      ? '/api/integrations/gmail/sync'
      : '/api/integrations/calendar/sync'
    try {
      const res  = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()
      setSyncMsg(m => ({ ...m, [provider]: `${data.synced ?? 0} elementos sincronizados` }))
    } catch {
      setSyncMsg(m => ({ ...m, [provider]: 'Error al sincronizar' }))
    } finally {
      setSyncing(null)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Configuración</h1>
          <p>Personalización del workspace</p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {(['workspace', 'etapas', 'integraciones', 'billing', 'api', 'cuenta'] as Tab[]).map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'cuenta' ? 'Mi cuenta' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'workspace' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card">
            <div className="card-head"><h3>Cuenta</h3></div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label className="lbl">Email</label>
                <input className="input" value={userEmail} disabled style={{ opacity: 0.6 }} />
              </div>
              <div className="field">
                <label className="lbl">Nombre del workspace</label>
                <input className="input" placeholder="Mi CRM" defaultValue="FG Medios" />
              </div>
              <div className="field">
                <label className="lbl">Zona horaria</label>
                <select className="input" defaultValue="America/Argentina/Buenos_Aires">
                  <option value="America/Argentina/Buenos_Aires">América/Buenos Aires (UTC-3)</option>
                  <option value="America/New_York">América/Nueva York (UTC-5)</option>
                  <option value="Europe/Madrid">Europa/Madrid (UTC+1)</option>
                </select>
              </div>
              <div className="field">
                <label className="lbl">Moneda</label>
                <select className="input" value={currency} onChange={e => changeCurrency(e.target.value as Currency)}>
                  <option value="ARS">ARS — Peso argentino</option>
                  <option value="USD">USD — Dólar estadounidense</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
              <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={flash}>
                {saved ? <><Icon name="check" size={13} /> Guardado</> : 'Guardar cambios'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Apariencia</h3></div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label className="lbl">Tema</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {(['Claro', 'Oscuro', 'Sistema'] as Theme[]).map(t => (
                    <button key={t} className={`btn ${theme === t ? 'primary' : 'ghost'}`} style={{ flex: 1 }}
                      onClick={() => changeTheme(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="lbl">Densidad</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {(['Compacta', 'Normal', 'Cómoda'] as Density[]).map(d => (
                    <button key={d} className={`btn ${density === d ? 'primary' : 'ghost'}`} style={{ flex: 1 }}
                      onClick={() => changeDensity(d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'etapas' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card">
            <div className="card-head">
              <h3>Etapas del pipeline</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stages.length} etapas</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {stages.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>#{i}</span>
                  <button className="btn ghost sm icon" onClick={() => removeStage(s.id)}>
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="Nueva etapa…"
                value={newStageLabel}
                onChange={e => setNewStageLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addStage()}
              />
              <input
                type="color"
                value="#6b8cff"
                style={{ width: 36, height: 32, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', padding: 2 }}
                onChange={e => {
                  const hex = e.target.value
                  setNewStageColor(hex)
                }}
              />
              <button className="btn primary" onClick={addStage} disabled={!newStageLabel.trim()}>
                <Icon name="plus" size={13} />
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Información</h3></div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Las etapas definen el flujo de tu pipeline Kanban. Puedes agregar etapas personalizadas o reordenarlas según tu proceso de ventas.
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Las etapas <strong>ganado</strong> y <strong>perdido</strong> son especiales y se usan para calcular tasas de cierre en los reportes.
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'integraciones' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { key: 'gmail',            name: 'Gmail',           desc: 'Sincroniza correos con contactos y deals',    icon: 'mail',     available: true },
            { key: 'google_calendar',  name: 'Google Calendar', desc: 'Sincroniza reuniones con tareas del CRM',     icon: 'meet',     available: true },
            { key: null,               name: 'WhatsApp',        desc: 'Recibe mensajes en el inbox del CRM',         icon: 'phone',    available: false },
            { key: null,               name: 'Slack',           desc: 'Notificaciones de actividad del pipeline',    icon: 'bell',     available: false },
            { key: null,               name: 'Meta Ads',        desc: 'Importa leads desde campañas de Meta',        icon: 'sparkles', available: false },
            { key: null,               name: 'Zapier',          desc: 'Conecta con +5000 aplicaciones vía Zapier',   icon: 'link',     available: false },
          ].map(int => {
            const conn      = int.key ? connections[int.key] : null
            const isConnected = !!conn
            const isSyncing   = syncing === int.key
            return (
              <div key={int.name} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--bg-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={int.icon} size={16} />
                  </div>
                  {isConnected
                    ? <span className="pill success" style={{ fontSize: 10 }}>Conectado</span>
                    : int.available
                      ? <span className="pill" style={{ fontSize: 10, background: 'var(--accent-soft)', color: 'var(--accent)' }}>Disponible</span>
                      : <span className="pill" style={{ fontSize: 10 }}>Próximamente</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{int.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{int.desc}</div>
                  {isConnected && conn?.email && (
                    <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="mail" size={10} /> {conn.email}
                    </div>
                  )}
                  {int.key && syncMsg[int.key] && (
                    <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>{syncMsg[int.key]}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                  {isConnected && int.key ? (
                    <>
                      <button
                        className="btn primary sm"
                        style={{ flex: 1 }}
                        disabled={isSyncing}
                        onClick={() => handleSync(int.key!)}
                      >
                        {isSyncing ? 'Sincronizando…' : 'Sincronizar'}
                      </button>
                      <button
                        className="btn ghost sm"
                        onClick={() => handleDisconnect(int.key!)}
                        title="Desconectar"
                      >
                        <Icon name="trash" size={12} />
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn ghost sm"
                      style={{ flex: 1 }}
                      disabled={!int.available}
                      onClick={() => int.key && handleConnect(int.key)}
                    >
                      {int.available ? 'Conectar' : 'Notificarme'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'billing' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card">
            <div className="card-head"><h3>Plan actual</h3></div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="sparkles" size={22} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>Plan Pro</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Hasta 10 usuarios · Todas las funciones</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Pipeline Kanban ilimitado', 'Reportes avanzados', 'Inbox integrado', 'Soporte prioritario'].map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <Icon name="check" size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <button className="btn primary">Gestionar suscripción</button>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Historial de facturas</h3></div>
            <div className="empty" style={{ padding: '32px 0' }}>
              <Icon name="doc" size={24} />
              <p style={{ marginTop: 8, fontSize: 13 }}>Sin facturas aún.</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'cuenta' && (
        <div style={{ maxWidth: 480 }}>
          <div className="card">
            <div className="card-head">
              <div>
                <h3>Mi cuenta</h3>
                <div className="sub">{userEmail}</div>
              </div>
            </div>
            <div className="card-pad">
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label>Nueva contraseña</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={pwForm.next}
                    onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label>Confirmar contraseña</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="Repetir nueva contraseña"
                    value={pwForm.confirm}
                    onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                    required
                  />
                </div>
                {pwMsg && (
                  <div style={{
                    fontSize: 13, padding: '8px 12px', borderRadius: 6,
                    background: pwMsg.ok ? 'var(--success-soft, oklch(95% 0.04 145))' : 'var(--danger-soft, oklch(95% 0.04 25))',
                    color: pwMsg.ok ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {pwMsg.text}
                  </div>
                )}
                <button
                  type="submit"
                  className="btn primary"
                  disabled={pwSaving || !pwForm.next || !pwForm.confirm}
                >
                  {pwSaving ? 'Guardando…' : 'Cambiar contraseña'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {tab === 'api' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card">
            <div className="card-head"><h3>API Keys</h3></div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label className="lbl">Tu API Key</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" value="ncrm_••••••••••••••••••••••••••••••••" readOnly style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                  <button className="btn ghost" onClick={flash}><Icon name="doc" size={13} /></button>
                </div>
              </div>
              <button className="btn danger ghost">Regenerar key</button>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                Usá esta key para autenticar requests a la API REST de Norte CRM. Nunca la compartas públicamente.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Documentación</h3></div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                La API REST permite integrar Norte CRM con tus sistemas externos.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['GET /api/contacts', 'POST /api/deals', 'PUT /api/tasks/:id', 'GET /api/pipeline/stages'].map(endpoint => (
                  <code key={endpoint} style={{ fontSize: 12, background: 'var(--bg-sunken)', padding: '6px 10px', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                    {endpoint}
                  </code>
                ))}
              </div>
              <button className="btn ghost" style={{ marginTop: 4 }}>
                <Icon name="globe" size={13} /> Ver documentación completa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
