// Norte CRM — Team Admin (gestión de vendedores)

function TeamAdmin({ go }) {
  const N = window.NORTE;
  const [tab, setTab] = useState('miembros');
  const [team, setTeam] = useState(N.team);
  const [selected, setSelected] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [filter, setFilter] = useState('todos');
  const [q, setQ] = useState('');

  const totalQuota = team.filter(t=>t.status==='activo').reduce((s,t)=>s+t.quota,0);
  const totalSold  = team.reduce((s,t)=>s+t.sold,0);
  const attainment = totalQuota ? Math.round((totalSold/totalQuota)*100) : 0;

  const filtered = useMemo(()=>{
    return team.filter(t => {
      if (filter !== 'todos' && t.permission !== filter && filter !== t.status) return false;
      if (q && !(`${t.name} ${t.email} ${t.role}`).toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [team, filter, q]);

  const updateMember = (id, patch) => setTeam(ts => ts.map(t => t.id===id ? {...t, ...patch} : t));
  const removeMember = (id) => { setTeam(ts => ts.filter(t => t.id !== id)); setSelected(null); };

  const sel = team.find(t => t.id === selected);

  return (
    <div className="page" style={{maxWidth:'none', padding:'24px 32px 48px'}}>
      <div className="page-head">
        <div>
          <h1>Equipo de ventas</h1>
          <p>{team.filter(t=>t.status==='activo').length} activos · {team.filter(t=>t.status==='invitado').length} invitación pendiente · cuota Q2 USD {(totalQuota/1000).toFixed(0)}k</p>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="archive" size={14}/> Exportar</button>
          <button className="btn primary" onClick={()=>setShowInvite(true)}><Icon name="plus" size={14}/> Invitar vendedor</button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:14}}>
        <div className="card stat">
          <div className="lbl">Cuota total Q2</div>
          <div className="val">USD {(totalQuota/1000).toFixed(0)}k</div>
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:8}}>
            <div style={{flex:1}}><Bar value={attainment}/></div>
            <span style={{fontSize:11.5, color:'var(--text-muted)', fontFamily:'var(--font-mono)'}}>{attainment}%</span>
          </div>
        </div>
        <div className="card stat">
          <div className="lbl">Vendido</div>
          <div className="val">USD {(totalSold/1000).toFixed(0)}k</div>
          <div className="delta up"><Icon name="arrow_up" size={11}/> +18% vs Q1</div>
        </div>
        <div className="card stat">
          <div className="lbl">Ticket promedio</div>
          <div className="val">USD {Math.round(totalSold/Math.max(1,team.reduce((s,t)=>s+t.deals,0))/1000)}k</div>
          <div className="delta up"><Icon name="arrow_up" size={11}/> +6%</div>
        </div>
        <div className="card stat">
          <div className="lbl">Win-rate equipo</div>
          <div className="val">{Math.round(team.filter(t=>t.deals>0).reduce((s,t,_,a)=>s+t.winRate/a.length,0))}%</div>
          <div className="delta up"><Icon name="arrow_up" size={11}/> +3.1pp</div>
        </div>
      </div>

      <div className="tabs" style={{marginBottom:18}}>
        {[
          {id:'miembros', l:'Miembros'},
          {id:'forecast', l:'Forecast'},
          {id:'cuotas',   l:'Cuotas y comisiones'},
          {id:'asign',    l:'Reglas de asignación'},
          {id:'permisos', l:'Roles y permisos'},
          {id:'auditoria',l:'Auditoría'},
        ].map(t => (
          <div key={t.id} className={`tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>{t.l}</div>
        ))}
      </div>

      {tab === 'miembros' && (
        <>
          <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap'}}>
            <div className="seg">
              {[['todos','Todos'],['admin','Admins'],['vendedor','Vendedores'],['sdr','SDRs'],['invitado','Invitaciones'],['inactivo','Inactivos']].map(([id,l])=>(
                <button key={id} className={filter===id?'on':''} onClick={()=>setFilter(id)}>{l}</button>
              ))}
            </div>
            <div style={{flex:1, maxWidth:280}}>
              <SearchInput placeholder="Buscar miembro…" value={q} onChange={setQ}/>
            </div>
            <button className="btn"><Icon name="filter" size={14}/> Más filtros</button>
          </div>

          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Rol</th>
                  <th>Región</th>
                  <th>Cuota Q2</th>
                  <th>Logro</th>
                  <th>Deals</th>
                  <th>Win-rate</th>
                  <th>Estado</th>
                  <th>Última actividad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const pct = m.quota ? Math.round((m.sold/m.quota)*100) : 0;
                  return (
                    <tr key={m.id} onClick={()=>setSelected(m.id)} className={selected===m.id?'selected':''}>
                      <td>
                        <div className="row-pic">
                          <Avatar name={m.name} tone={m.tone}/>
                          <div>
                            <div className="cell-strong">{m.name}</div>
                            <div className="cell-mono">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{m.role}</td>
                      <td className="cell-muted">{m.region}</td>
                      <td className="cell-mono">{m.quota ? `$${(m.quota/1000).toFixed(0)}k` : '—'}</td>
                      <td>
                        <div style={{display:'flex', alignItems:'center', gap:8, width:160}}>
                          <Bar value={Math.min(pct,100)}/>
                          <span className="cell-mono" style={{minWidth:42, textAlign:'right', color: pct>=80?'var(--success)':pct>=40?'var(--text)':'var(--text-muted)'}}>{pct}%</span>
                        </div>
                      </td>
                      <td className="cell-mono">{m.deals}</td>
                      <td className="cell-mono">{m.winRate}%</td>
                      <td>
                        {m.status === 'activo' && <span className="pill success"><span className="dot"/>Activo</span>}
                        {m.status === 'inactivo' && <span className="pill"><span className="dot"/>Inactivo</span>}
                        {m.status === 'invitado' && <span className="pill warning"><span className="dot"/>Invitado</span>}
                      </td>
                      <td className="cell-muted">{m.lastActive}</td>
                      <td onClick={e=>e.stopPropagation()}>
                        <button className="btn ghost sm icon"><Icon name="more" size={14}/></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'forecast' && <ForecastView/>}
      {tab === 'cuotas' && <QuotasView team={team} updateMember={updateMember}/>}
      {tab === 'asign'  && <AssignmentRules team={team}/>}
      {tab === 'permisos' && <PermissionsMatrix/>}
      {tab === 'auditoria' && <AuditLog/>}

      {sel && <MemberDrawer member={sel} onClose={()=>setSelected(null)} onUpdate={updateMember} onRemove={removeMember}/>}
      {showInvite && <InviteModal onClose={()=>setShowInvite(false)} onInvite={(m)=>{setTeam(ts=>[...ts, m]); setShowInvite(false);}}/>}
    </div>
  );
}

function QuotasView({ team, updateMember }) {
  return (
    <div className="card" style={{padding:0, overflow:'hidden'}}>
      <div className="card-head">
        <div>
          <h3>Cuotas Q2 2026</h3>
          <div className="sub">Edita la cuota individual y la regla de comisión</div>
        </div>
        <button className="btn sm">Aplicar plantilla</button>
      </div>
      <table className="tbl">
        <thead>
          <tr><th>Vendedor</th><th>Cuota Q2</th><th>Comisión base</th><th>Acelerador &gt;100%</th><th>Bonus cierre Q</th><th>Proyección</th></tr>
        </thead>
        <tbody>
          {team.filter(t=>t.status!=='invitado').map(m => {
            const pct = m.quota ? (m.sold/m.quota) : 0;
            const projection = Math.round(m.sold * (1 + (1-pct) * 0.6));
            return (
              <tr key={m.id}>
                <td>
                  <div className="row-pic">
                    <Avatar name={m.name} tone={m.tone}/>
                    <div className="cell-strong">{m.name}</div>
                  </div>
                </td>
                <td>
                  <div style={{display:'inline-flex', alignItems:'center', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', height:26, padding:'0 8px', background:'var(--bg-panel)'}}>
                    <span style={{color:'var(--text-subtle)', fontFamily:'var(--font-mono)', fontSize:11}}>USD</span>
                    <input style={{border:0, outline:0, background:'transparent', width:80, fontFamily:'var(--font-mono)', fontSize:13, marginLeft:4}} defaultValue={(m.quota/1000).toFixed(0)+'k'}/>
                  </div>
                </td>
                <td className="cell-mono">8%</td>
                <td className="cell-mono">+4pp</td>
                <td className="cell-mono">USD 1.5k</td>
                <td className="cell-mono">{m.quota? `${Math.round((projection/m.quota)*100)}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AssignmentRules({ team }) {
  const rules = [
    { id:'r1', name:'Round-robin LATAM', cond:'región = AR, MX, CL, CO', assign:['Ana López','Pablo Yánez','Lía Marín'], active:true, leads:42 },
    { id:'r2', name:'Cuentas grandes >USD 50k', cond:'monto estimado ≥ 50.000 USD', assign:['Sofía Aramburu','Pablo Yánez'], active:true, leads:8 },
    { id:'r3', name:'Inbound web España', cond:'origen = inbound web · región = ES', assign:['Diego Ferrer'], active:false, leads:0 },
    { id:'r4', name:'Referidos — owner anterior', cond:'fuente = referido · cliente existente', assign:['mantener owner'], active:true, leads:14 },
  ];
  return (
    <div>
      <div className="card" style={{marginBottom:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:12, background:'linear-gradient(135deg, var(--accent-soft), transparent 80%)', borderColor:'transparent'}}>
        <Icon name="zap" size={16} style={{color:'var(--accent)'}}/>
        <div style={{flex:1}}>
          <div style={{fontSize:13, fontWeight:500}}>Las reglas se ejecutan en orden, primero que coincida gana.</div>
          <div style={{fontSize:12, color:'var(--text-muted)', marginTop:2}}>Si ninguna regla coincide, el lead queda sin asignar y aparece en la cola general.</div>
        </div>
        <button className="btn primary"><Icon name="plus" size={14}/> Nueva regla</button>
      </div>

      <div className="card" style={{padding:0, overflow:'hidden'}}>
        {rules.map((r,i) => (
          <div key={r.id} style={{padding:'14px 18px', borderBottom:i<rules.length-1?'1px solid var(--border)':'none', display:'flex', alignItems:'center', gap:14}}>
            <span style={{color:'var(--text-subtle)', cursor:'grab'}}><Icon name="drag" size={14}/></span>
            <div style={{width:22, height:22, borderRadius:6, background:'var(--bg-sunken)', border:'1px solid var(--border)', display:'grid', placeItems:'center', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)'}}>{i+1}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <div style={{fontSize:13, fontWeight:500}}>{r.name}</div>
                {r.active ? <span className="pill success"><span className="dot"/>Activa</span> : <span className="pill"><span className="dot"/>Pausada</span>}
              </div>
              <div style={{fontSize:12, color:'var(--text-muted)', marginTop:3, fontFamily:'var(--font-mono)'}}>cuando {r.cond}</div>
              <div style={{fontSize:12, color:'var(--text-muted)', marginTop:4, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                <span style={{color:'var(--text-subtle)'}}>asignar a</span>
                {r.assign.map(a => <span key={a} className="pill accent">{a}</span>)}
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:11.5, color:'var(--text-subtle)'}}>leads asignados</div>
              <div style={{fontFamily:'var(--font-mono)', fontSize:14, fontWeight:500}}>{r.leads}</div>
            </div>
            <button className="btn sm">Editar</button>
            <button className="btn ghost sm icon"><Icon name="more" size={14}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PermissionsMatrix() {
  const roles = ['Admin', 'Manager', 'Vendedor', 'SDR', 'Solo lectura'];
  const perms = [
    { g:'Contactos', items:[
      ['Ver todos los contactos',  [1,1,0,0,1]],
      ['Editar contactos propios', [1,1,1,1,0]],
      ['Editar contactos de otros',[1,1,0,0,0]],
      ['Eliminar contactos',       [1,0,0,0,0]],
    ]},
    { g:'Pipeline', items:[
      ['Crear deals',              [1,1,1,1,0]],
      ['Ver deals de otros',       [1,1,0,0,1]],
      ['Cambiar etapa',            [1,1,1,0,0]],
      ['Cerrar deals (ganado)',    [1,1,1,0,0]],
    ]},
    { g:'Equipo y configuración', items:[
      ['Invitar miembros',         [1,1,0,0,0]],
      ['Editar cuotas',            [1,1,0,0,0]],
      ['Editar reglas asignación', [1,1,0,0,0]],
      ['Acceso a auditoría',       [1,1,0,0,0]],
      ['Configurar integraciones', [1,0,0,0,0]],
    ]},
    { g:'Reportes', items:[
      ['Ver reportes propios',     [1,1,1,1,1]],
      ['Ver reportes del equipo',  [1,1,0,0,1]],
      ['Exportar datos',           [1,1,0,0,0]],
    ]},
  ];
  return (
    <div className="card" style={{padding:0, overflow:'hidden'}}>
      <div className="card-head">
        <div><h3>Roles y permisos</h3><div className="sub">Define qué puede hacer cada rol del equipo</div></div>
        <button className="btn sm"><Icon name="plus" size={13}/> Rol personalizado</button>
      </div>
      <div style={{overflowX:'auto'}}>
        <table className="tbl" style={{minWidth:760}}>
          <thead>
            <tr>
              <th>Permiso</th>
              {roles.map(r => <th key={r} style={{textAlign:'center'}}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {perms.map(group => (
              <React.Fragment key={group.g}>
                <tr>
                  <td colSpan={roles.length+1} style={{background:'var(--bg-sunken)', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-subtle)', padding:'8px 18px'}}>{group.g}</td>
                </tr>
                {group.items.map(([label, vals]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {vals.map((v,i)=>(
                      <td key={i} style={{textAlign:'center'}}>
                        {v ? (
                          <span style={{display:'inline-grid', placeItems:'center', width:18, height:18, borderRadius:'50%', background:'var(--success-soft)', color:'var(--success)'}}>
                            <Icon name="check" size={11}/>
                          </span>
                        ) : (
                          <span style={{color:'var(--border-strong)'}}>—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditLog() {
  const events = [
    { who:'Sofía Aramburu', what:'cambió la cuota Q2 de Pablo Yánez', from:'USD 120k', to:'USD 150k', when:'hace 12 min', icon:'edit' },
    { who:'Sofía Aramburu', what:'invitó a Mariana Solís como Vendedora', when:'hace 2 h', icon:'plus' },
    { who:'Pablo Yánez',    what:'reasignó deal "Lanzamiento Verde Salud"', from:'Ana López', to:'Sofía Aramburu', when:'hace 5 h', icon:'team' },
    { who:'Sistema',        what:'desactivó a Diego Ferrer por inactividad (>9 días)', when:'ayer', icon:'archive' },
    { who:'Sofía Aramburu', what:'editó la regla "Round-robin LATAM"', when:'hace 2 días', icon:'edit' },
    { who:'Ana López',      what:'inició sesión desde nueva ubicación · Buenos Aires', when:'hace 2 días', icon:'globe' },
    { who:'Sofía Aramburu', what:'creó el rol personalizado "Manager regional"', when:'hace 4 días', icon:'plus' },
  ];
  return (
    <div className="card" style={{padding:0}}>
      <div className="card-head">
        <div><h3>Auditoría</h3><div className="sub">Cambios en el equipo, permisos y datos críticos</div></div>
        <div style={{display:'flex', gap:6}}>
          <button className="btn sm"><Icon name="filter" size={13}/> Filtrar</button>
          <button className="btn sm"><Icon name="archive" size={13}/> Exportar CSV</button>
        </div>
      </div>
      <div style={{padding:'4px 0'}}>
        {events.map((e,i) => (
          <div key={i} style={{display:'flex', gap:14, padding:'12px 18px', borderBottom:i<events.length-1?'1px solid var(--border)':'none', alignItems:'flex-start'}}>
            <div style={{width:28, height:28, borderRadius:6, background:'var(--bg-sunken)', border:'1px solid var(--border)', display:'grid', placeItems:'center', color:'var(--text-muted)', flexShrink:0}}>
              <Icon name={e.icon} size={13}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:12.5}}>
                <b style={{fontWeight:500}}>{e.who}</b>{' '}
                <span style={{color:'var(--text-muted)'}}>{e.what}</span>
                {e.from && <> <span style={{color:'var(--text-muted)'}}>de</span> <span style={{fontFamily:'var(--font-mono)', fontSize:11.5, padding:'1px 5px', borderRadius:3, background:'var(--bg-sunken)', border:'1px solid var(--border)'}}>{e.from}</span> <span style={{color:'var(--text-muted)'}}>→</span> <span style={{fontFamily:'var(--font-mono)', fontSize:11.5, padding:'1px 5px', borderRadius:3, background:'var(--accent-soft)', color:'var(--accent)'}}>{e.to}</span></>}
              </div>
              <div style={{fontSize:11, color:'var(--text-subtle)', marginTop:3}}>{e.when}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemberDrawer({ member, onClose, onUpdate, onRemove }) {
  const N = window.NORTE;
  const ownedDeals = N.deals.filter(d => {
    const map = { 'u_tu':'tu', 'u_ana':'Ana', 'u_pablo':'Pablo' };
    return d.owner === map[member.id];
  });
  const pct = member.quota ? Math.round((member.sold/member.quota)*100) : 0;

  return (
    <div onClick={onClose} style={{position:'fixed', inset:0, background:'rgba(10,12,18,.4)', zIndex:50, display:'flex', justifyContent:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:480, height:'100%', background:'var(--bg-panel)', borderLeft:'1px solid var(--border)',
        boxShadow:'var(--shadow-pop)', display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        <div style={{padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10}}>
          <Avatar name={member.name} size="lg" tone={member.tone}/>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:15, fontWeight:600, letterSpacing:'-0.01em'}}>{member.name}</div>
            <div style={{fontSize:12, color:'var(--text-muted)'}}>{member.email}</div>
          </div>
          <button className="btn ghost sm icon" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>

        <div style={{flex:1, overflowY:'auto', padding:'18px 20px', display:'flex', flexDirection:'column', gap:16}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
            <div className="field">
              <label>Rol</label>
              <select className="input" defaultValue={member.permission} onChange={e=>onUpdate(member.id,{permission:e.target.value, role: e.target.value === 'admin' ? 'Admin' : e.target.value === 'sdr' ? 'SDR' : 'Vendedor'})}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="vendedor">Vendedor</option>
                <option value="sdr">SDR</option>
                <option value="readonly">Solo lectura</option>
              </select>
            </div>
            <div className="field">
              <label>Región</label>
              <select className="input" defaultValue={member.region}>
                {['LATAM','AR','MX','CL','CO','ES','BR','PE','UY'].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Cuota Q2 (USD)</label>
              <input className="input" type="number" defaultValue={member.quota} onChange={e=>onUpdate(member.id,{quota:+e.target.value})}/>
            </div>
            <div className="field">
              <label>Estado</label>
              <select className="input" defaultValue={member.status} onChange={e=>onUpdate(member.id,{status:e.target.value})}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo (suspender)</option>
                <option value="invitado">Invitado</option>
              </select>
            </div>
          </div>

          <div className="card" style={{padding:14}}>
            <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-subtle)', marginBottom:10}}>Performance Q2</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12}}>
              <div>
                <div style={{fontSize:11, color:'var(--text-muted)'}}>Vendido</div>
                <div style={{fontSize:18, fontWeight:600, fontFamily:'var(--font-mono)'}}>${(member.sold/1000).toFixed(0)}k</div>
              </div>
              <div>
                <div style={{fontSize:11, color:'var(--text-muted)'}}>Logro</div>
                <div style={{fontSize:18, fontWeight:600, fontFamily:'var(--font-mono)', color:pct>=80?'var(--success)':'var(--text)'}}>{pct}%</div>
              </div>
              <div>
                <div style={{fontSize:11, color:'var(--text-muted)'}}>Win-rate</div>
                <div style={{fontSize:18, fontWeight:600, fontFamily:'var(--font-mono)'}}>{member.winRate}%</div>
              </div>
            </div>
            <div className="bar"><span style={{width:`${Math.min(pct,100)}%`}}/></div>
            <div style={{display:'flex', justifyContent:'space-between', marginTop:6, fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)'}}>
              <span>USD 0</span><span>cuota USD {(member.quota/1000).toFixed(0)}k</span>
            </div>
          </div>

          <div>
            <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-subtle)', marginBottom:8}}>Deals asignados ({ownedDeals.length})</div>
            <div className="card" style={{padding:0}}>
              {ownedDeals.length === 0 ? (
                <div className="empty" style={{padding:24}}><p>Sin deals activos asignados</p></div>
              ) : ownedDeals.map((d,i) => {
                const stage = N.stages.find(s => s.id === d.stage);
                return (
                  <div key={d.id} style={{padding:'10px 14px', borderBottom:i<ownedDeals.length-1?'1px solid var(--border)':'none', display:'flex', alignItems:'center', gap:8}}>
                    <span style={{width:8, height:8, borderRadius:2, background:stage.color, flexShrink:0}}/>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:12.5, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{d.title}</div>
                      <div style={{fontSize:11, color:'var(--text-muted)'}}>{stage.label} · cierra {d.close}</div>
                    </div>
                    <div style={{fontFamily:'var(--font-mono)', fontSize:12, fontWeight:500}}>${d.amount.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
            <button className="btn sm" style={{marginTop:8}}><Icon name="team" size={13}/> Reasignar todo</button>
          </div>

          <div>
            <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-subtle)', marginBottom:8}}>Sesiones recientes</div>
            <div style={{fontSize:12, color:'var(--text-muted)', display:'flex', flexDirection:'column', gap:4}}>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Mac · Chrome</span><span style={{fontFamily:'var(--font-mono)', fontSize:11}}>{member.lastActive}</span></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>iPhone · Safari</span><span style={{fontFamily:'var(--font-mono)', fontSize:11}}>hace 3 días</span></div>
            </div>
          </div>
        </div>

        <div style={{padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:8, alignItems:'center'}}>
          <button className="btn ghost sm" style={{color:'var(--danger)'}} onClick={()=>{if(confirm(`¿Quitar a ${member.name} del workspace?`)) onRemove(member.id);}}>
            <Icon name="x" size={13}/> Eliminar miembro
          </button>
          <div style={{flex:1}}/>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={onClose}>Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ onClose, onInvite }) {
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState('vendedor');
  const [region, setRegion] = useState('LATAM');
  const [quota, setQuota] = useState(120000);

  const handleInvite = () => {
    const list = emails.split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
    if (!list.length) return;
    list.forEach((em, i) => {
      const name = em.split('@')[0].split('.').map(p=>p[0].toUpperCase()+p.slice(1)).join(' ');
      onInvite({
        id: `u_new_${Date.now()}_${i}`, name, email: em, role: role==='admin'?'Admin':role==='sdr'?'SDR':'Vendedor',
        tone: ['accent','info','success','warning'][i%4], status: 'invitado', permission: role,
        quota: role==='sdr'?60000:quota, sold:0, deals:0, winRate:0, lastActive:'—', joined:'—', region,
      });
    });
  };

  return (
    <div onClick={onClose} style={{position:'fixed', inset:0, background:'rgba(10,12,18,.5)', zIndex:60, display:'grid', placeItems:'center'}}>
      <div onClick={e=>e.stopPropagation()} className="card" style={{width:520, boxShadow:'var(--shadow-pop)'}}>
        <div style={{padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center'}}>
          <div>
            <div style={{fontSize:15, fontWeight:600}}>Invitar al equipo</div>
            <div style={{fontSize:12, color:'var(--text-muted)', marginTop:2}}>Recibirán un email con el link de acceso</div>
          </div>
          <div style={{flex:1}}/>
          <button className="btn ghost sm icon" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <div style={{padding:18, display:'flex', flexDirection:'column', gap:12}}>
          <div className="field">
            <label>Emails (uno por línea, o separados por coma)</label>
            <textarea className="input" rows={3} placeholder="ana@cliente.com, juan@cliente.com" value={emails} onChange={e=>setEmails(e.target.value)}/>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
            <div className="field">
              <label>Rol</label>
              <select className="input" value={role} onChange={e=>setRole(e.target.value)}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="vendedor">Vendedor</option>
                <option value="sdr">SDR</option>
                <option value="readonly">Solo lectura</option>
              </select>
            </div>
            <div className="field">
              <label>Región</label>
              <select className="input" value={region} onChange={e=>setRegion(e.target.value)}>
                {['LATAM','AR','MX','CL','CO','ES','BR','PE','UY'].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Cuota Q2 sugerida (USD)</label>
            <input className="input" type="number" value={quota} onChange={e=>setQuota(+e.target.value)}/>
          </div>
          <div style={{display:'flex', alignItems:'flex-start', gap:8, padding:'10px 12px', background:'var(--accent-soft)', borderRadius:'var(--r-sm)'}}>
            <Icon name="sparkles" size={14} style={{color:'var(--accent)', marginTop:2}}/>
            <div style={{fontSize:12, color:'var(--text-muted)', textWrap:'pretty'}}>Los nuevos vendedores entrarán a la regla <b style={{color:'var(--text)'}}>Round-robin LATAM</b> automáticamente. Puedes cambiarlo en <b style={{color:'var(--text)'}}>Reglas de asignación</b>.</div>
          </div>
        </div>
        <div style={{padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8}}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={handleInvite}><Icon name="send" size={13}/> Enviar invitaciones</button>
        </div>
      </div>
    </div>
  );
}

window.TeamAdmin = TeamAdmin;
