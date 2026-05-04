// Norte CRM — App shell + router

const { useState: uS, useEffect: uE } = React;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = uS({ name: 'dashboard', params: {} });

  uE(() => {
    document.documentElement.dataset.theme = t.dark ? 'dark' : 'light';
    document.documentElement.dataset.density = t.density;
    document.documentElement.style.setProperty('--accent', t.accent);
    document.documentElement.style.setProperty('--accent-hover', t.accent);
    document.documentElement.style.setProperty('--accent-soft',
    t.dark ? `color-mix(in oklch, ${t.accent} 30%, var(--bg-panel))` : `color-mix(in oklch, ${t.accent} 18%, white)`);
  }, [t.dark, t.density, t.accent]);

  const go = (name, params = {}) => setRoute({ name, params });

  const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'contacts', label: 'Contactos', icon: 'contacts', count: window.NORTE.contacts.length },
  { id: 'pipeline', label: 'Pipeline', icon: 'pipeline', count: window.NORTE.deals.length },
  { id: 'tasks', label: 'Tareas', icon: 'tasks', count: window.NORTE.tasks.filter((x) => !x.done).length },
  { id: 'calendar', label: 'Calendario', icon: 'calendar' },
  { id: 'reports', label: 'Reportes', icon: 'reports' },
  { id: 'inbox', label: 'Inbox', icon: 'inbox', count: 3 },
  { id: 'team', label: 'Equipo', icon: 'team', count: window.NORTE.team.length }];


  const screens = {
    dashboard: { c: <Dashboard go={go} />, title: ['Dashboard'] },
    contacts: { c: <Contacts go={go} openContact={(id) => go('contact', { id })} />, title: ['Contactos'] },
    contact: {
      c: <ContactDetail id={route.params.id} go={go} back={() => go('contacts')} />,
      title: ['Contactos', (window.NORTE.contacts.find((c) => c.id === route.params.id) || {}).name || 'Contacto']
    },
    pipeline: { c: <Pipeline />, title: ['Pipeline'], flush: true },
    tasks: { c: <Tasks />, title: ['Tareas'] },
    calendar: { c: <Calendar />, title: ['Calendario'] },
    reports: { c: <Reports />, title: ['Reportes'] },
    inbox: { c: <Inbox />, title: ['Inbox'], flush: true },
    team: { c: <TeamAdmin go={go} />, title: ['Equipo de ventas'] },
    settings: { c: <Settings />, title: ['Configuración'], flush: true }
  };
  const cur = screens[route.name] || screens.dashboard;

  return (
    <div className="app" data-screen-label={cur.title.join(' / ')}>
      <aside className="sidebar">
        <div className="sidebar-head" style={{ background: '#0d1117', borderBottomColor: 'rgba(255,255,255,.08)' }}>
          <div className="workspace" style={{ gap: 0 }}>
            <img src="logo.png" alt="FG Medios" style={{ height: 28, maxWidth: '100%', objectFit: 'contain' }} />
            <span className="workspace-chev" style={{ color: 'rgba(255,255,255,.4)', marginLeft: 'auto' }}><Icon name="chev_down" size={13} /></span>
          </div>
        </div>
        <div style={{ padding: '10px 10px 4px', position: 'relative' }} className="sidebar-search">
          <span className="ico"><Icon name="search" size={13} /></span>
          <input placeholder="Buscar" />
          <kbd>⌘K</kbd>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">Espacio de trabajo</div>
          {nav.map((n) =>
          <div key={n.id} className={`nav-item ${route.name === n.id || n.id === 'contacts' && route.name === 'contact' ? 'active' : ''}`} onClick={() => go(n.id)}>
              <span className="nav-ico"><Icon name={n.icon} size={15} /></span>
              <span>{n.label}</span>
              {typeof n.count === 'number' && <span className="nav-count">{n.count}</span>}
            </div>
          )}
          <div className="nav-section">Vistas guardadas</div>
          {[
          { l: 'Mis deals abiertos', i: 'pipeline' },
          { l: 'Clientes recurrentes', i: 'star' },
          { l: 'Sin actividad +14d', i: 'flag' }].
          map((s) =>
          <div key={s.l} className="nav-item">
              <span className="nav-ico"><Icon name={s.i} size={14} /></span>
              <span>{s.l}</span>
            </div>
          )}
        </nav>
        <div className="sidebar-foot">
          <Avatar name="Sofía Aramburu" tone="accent" />
          <div className="user-meta">
            <b>Sofía Aramburu</b>
            <span>Owner</span>
          </div>
          <button className="btn ghost sm icon" onClick={() => go('settings')}><Icon name="settings" size={14} /></button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="crumbs">
            {cur.title.map((t, i, arr) =>
            <React.Fragment key={i}>
                <span className={`crumb ${i === arr.length - 1 ? 'current' : ''}`}>{t}</span>
                {i < arr.length - 1 && <span className="sep"><Icon name="chev_right" size={12} /></span>}
              </React.Fragment>
            )}
          </div>
          <div className="topbar-spacer" />
          <div className="topbar-actions">
            <button className="btn ghost icon"><Icon name="search" size={14} /></button>
            <button className="btn ghost icon"><Icon name="bell" size={14} /></button>
            <button className="btn ghost icon" onClick={() => setTweak('dark', !t.dark)}>
              <Icon name={t.dark ? 'sparkles' : 'sparkles'} size={14} />
            </button>
            <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
            <button className="btn primary"><Icon name="plus" size={13} /> Nuevo</button>
          </div>
        </div>
        <div className={`view ${cur.flush ? 'flush' : ''}`}>
          {cur.c}
        </div>
      </main>

      <TweaksPanel>
        <TweakSection label="Apariencia" />
        <TweakToggle label="Modo oscuro" value={t.dark} onChange={(v) => setTweak('dark', v)} />
        <TweakRadio label="Densidad" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakColor label="Color de acento" value={t.accent} onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Pre-sets" />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
          { n: 'Violeta', c: '#7c5cf2' },
          { n: 'Índigo', c: '#5566f1' },
          { n: 'Verde', c: '#3a9d6e' },
          { n: 'Naranja', c: '#d97757' },
          { n: 'Grafito', c: '#3d4452' }].
          map((p) =>
          <button key={p.n} onClick={() => setTweak('accent', p.c)} style={{
            flex: '1 0 30%', height: 28, padding: '0 8px', borderRadius: 6,
            border: '1px solid rgba(0,0,0,.1)', background: 'rgba(255,255,255,.6)',
            fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, cursor: 'default'
          }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: p.c }} /> {p.n}
            </button>
          )}
        </div>
      </TweaksPanel>
    </div>);

}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "density": "regular",
  "accent": "#7c5cf2"
} /*EDITMODE-END*/;

ReactDOM.createRoot(document.getElementById('root')).render(<App />);