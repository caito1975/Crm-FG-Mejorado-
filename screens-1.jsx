// Norte CRM — screens part 1: Dashboard, Contacts, Contact detail, Pipeline
const { useState, useMemo, useRef, useEffect } = React;

// ─── DASHBOARD ───────────────────────────────────────────────
function Dashboard({ go }) {
  const N = window.NORTE;
  const totalPipeline = N.deals.filter(d => d.stage !== 'cerrado').reduce((s,d)=>s+d.amount, 0);
  const won = N.deals.filter(d => d.stage === 'cerrado').reduce((s,d)=>s+d.amount, 0);
  const openCount = N.deals.filter(d => d.stage !== 'cerrado').length;
  const tasksOpen = N.tasks.filter(t => !t.done).length;
  const revData = N.revenue.map(r => r.v);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Buenos días, Sofía</h1>
          <p>Tienes <b style={{color:'var(--text)'}}>{tasksOpen} tareas pendientes</b> · 3 propuestas esperan respuesta esta semana.</p>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="filter" size={14}/> Última semana</button>
          <button className="btn primary"><Icon name="plus" size={14}/> Nuevo deal</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:20}}>
        <StatTile lbl="Pipeline abierto" val={`USD ${(totalPipeline/1000).toFixed(0)}k`} delta="+12.4%" up data={[20,28,24,32,38,42,51,58,64]} />
        <StatTile lbl="Ganado este Q"   val={`USD ${(won/1000).toFixed(0)}k`}            delta="+8.2%"  up data={[12,18,15,22,28,32,38,40,48]} color="oklch(58% 0.13 155)" />
        <StatTile lbl="Tasa de cierre"  val="38%"                                          delta="+3.1pp" up data={[24,28,30,32,34,36,38,36,38]} color="oklch(65% 0.13 230)" />
        <StatTile lbl="Tiempo medio"    val="14 días"                                      delta="-2 d"   up data={[22,20,19,18,17,16,15,14,14]} color="oklch(70% 0.13 75)" />
      </div>

      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:12, marginBottom:12}}>
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Ingresos por mes</h3>
              <div className="sub">Últimos 9 meses · USD miles</div>
            </div>
            <div className="seg">
              <button className="on">9M</button>
              <button>6M</button>
              <button>3M</button>
            </div>
          </div>
          <div style={{padding:'18px 20px 22px'}}>
            <RevenueChart data={N.revenue}/>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Origen de leads</h3>
            <button className="btn ghost sm icon"><Icon name="more" size={14}/></button>
          </div>
          <div className="card-pad" style={{display:'flex', flexDirection:'column', gap:14}}>
            {N.sources.map(s => (
              <div key={s.label}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5}}>
                  <span>{s.label}</span>
                  <span style={{color:'var(--text-muted)', fontVariantNumeric:'tabular-nums'}}>{s.v}%</span>
                </div>
                <div className="bar"><span style={{width:`${s.v*2}%`, background:s.color}}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div className="card">
          <div className="card-head">
            <h3>Tareas para hoy</h3>
            <button className="btn ghost sm" onClick={()=>go('tasks')}>Ver todas <Icon name="chev_right" size={12}/></button>
          </div>
          <div>
            {N.tasks.filter(t=>!t.done).slice(0,5).map((t, i) => (
              <TaskRow key={t.id} task={t} divider={i<4}/>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Actividad reciente</h3>
            <button className="btn ghost sm icon"><Icon name="more" size={14}/></button>
          </div>
          <div style={{padding:'8px 0'}}>
            {N.activities.map(a => <ActivityRow key={a.id} a={a}/>)}
          </div>
        </div>
      </div>

      {/* AI brief assistant — discreet floating capsule */}
      <div className="card" style={{marginTop:12, background:'linear-gradient(135deg, var(--accent-soft), transparent 70%)', borderColor:'transparent'}}>
        <div style={{padding:'14px 18px', display:'flex', alignItems:'center', gap:12}}>
          <div style={{width:32, height:32, borderRadius:8, background:'var(--accent)', color:'white', display:'grid', placeItems:'center', flexShrink:0}}>
            <Icon name="sparkles" size={16}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13, fontWeight:500}}>Brief assistant — Casa Lupe esta semana</div>
            <div style={{fontSize:12, color:'var(--text-muted)', marginTop:2}}>
              Renata pidió mood; el deal está en propuesta hace 11 días. Sugiero enviar v2 con foco en fotografía y bloquear 30 min con ella el jueves.
            </div>
          </div>
          <button className="btn sm">Descartar</button>
          <button className="btn primary sm">Generar plan</button>
        </div>
      </div>
    </div>
  );
}

const StatTile = ({ lbl, val, delta, up, data, color }) => (
  <div className="card stat">
    <div className="lbl">{lbl}</div>
    <div className="val">{val}</div>
    <div className={`delta ${up?'up':'down'}`}>
      <Icon name={up?'arrow_up':'arrow_dn'} size={11}/> {delta}
    </div>
    <div className="spark"><Sparkline data={data} color={color || 'var(--accent)'} width={210}/></div>
  </div>
);

function RevenueChart({ data }) {
  const W = 700, H = 200, P = { l: 36, r: 12, t: 12, b: 24 };
  const max = Math.max(...data.map(d=>d.v));
  const stepX = (W - P.l - P.r) / (data.length - 1);
  const yFor = v => H - P.b - (v / max) * (H - P.t - P.b);
  const pts = data.map((d, i) => [P.l + i*stepX, yFor(d.v)]);
  const line = pts.map((p,i)=>(i===0?`M${p[0]},${p[1]}`:`L${p[0]},${p[1]}`)).join(' ');
  const area = `${line} L${pts[pts.length-1][0]},${H-P.b} L${pts[0][0]},${H-P.b} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', height:200, display:'block'}}>
      {grid.map((g,i)=>{
        const y = P.t + g*(H-P.t-P.b);
        return <g key={i}>
          <line x1={P.l} x2={W-P.r} y1={y} y2={y} stroke="var(--border)" strokeDasharray={i===grid.length-1?'':'2 4'}/>
          <text x={P.l-6} y={y+3} fontSize="10" fill="var(--text-subtle)" textAnchor="end" fontFamily="var(--font-mono)">
            {Math.round(max*(1-g))}k
          </text>
        </g>;
      })}
      <path d={area} fill="var(--accent)" opacity="0.10"/>
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round"/>
      {pts.map((p,i)=>(
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="3" fill="var(--bg-panel)" stroke="var(--accent)" strokeWidth="1.5"/>
          <text x={p[0]} y={H-8} fontSize="10" fill="var(--text-subtle)" textAnchor="middle">{data[i].m}</text>
        </g>
      ))}
    </svg>
  );
}

function TaskRow({ task, divider }) {
  const [done, setDone] = useState(task.done);
  const N = window.NORTE;
  const c = N.contacts.find(x => x.id === task.contact);
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'10px 16px',
      borderBottom: divider ? '1px solid var(--border)' : 'none',
    }}>
      <span className={`chk ${done?'on':''}`} onClick={()=>setDone(!done)}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:13, fontWeight:450, textDecoration: done?'line-through':'none', color: done?'var(--text-muted)':'var(--text)'}}>{task.title}</div>
        <div style={{fontSize:11.5, color:'var(--text-muted)', marginTop:2, display:'flex', gap:8, alignItems:'center'}}>
          <Icon name="clock" size={11}/> {task.due}
          {c && <><span style={{color:'var(--border-strong)'}}>·</span> {c.company}</>}
        </div>
      </div>
      <PriorityPill p={task.priority}/>
    </div>
  );
}

function ActivityRow({ a }) {
  const ico = {
    email_in: 'mail', email_out: 'send', call_out: 'phone',
    meeting: 'meet', note: 'edit', invoice: 'card',
  }[a.kind] || 'doc';
  const N = window.NORTE;
  const c = N.contacts.find(x => x.id === a.contact);
  return (
    <div style={{display:'flex', gap:10, padding:'10px 18px', alignItems:'flex-start'}}>
      <div style={{width:28, height:28, borderRadius:6, background:'var(--bg-sunken)', border:'1px solid var(--border)', display:'grid', placeItems:'center', color:'var(--text-muted)', flexShrink:0}}>
        <Icon name={ico} size={13}/>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:12.5, color:'var(--text)'}}>
          <b style={{fontWeight:500}}>{a.who}</b> <span style={{color:'var(--text-muted)'}}>· {c && c.company}</span>
        </div>
        <div style={{fontSize:12.5, color:'var(--text-muted)', marginTop:2, textWrap:'pretty'}}>{a.text}</div>
        <div style={{fontSize:11, color:'var(--text-subtle)', marginTop:3}}>{a.when}</div>
      </div>
    </div>
  );
}

// ─── CONTACTS LIST ───────────────────────────────────────────
function Contacts({ go, openContact }) {
  const N = window.NORTE;
  const [filter, setFilter] = useState('todos');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(new Set());

  const filtered = useMemo(() => {
    return N.contacts.filter(c => {
      if (filter !== 'todos' && c.status !== filter) return false;
      if (q && !(`${c.name} ${c.company} ${c.role}`).toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [filter, q]);

  const toggle = id => {
    const s = new Set(sel);
    s.has(id) ? s.delete(id) : s.add(id);
    setSel(s);
  };

  return (
    <div className="page" style={{maxWidth:'none', padding:'24px 32px 24px'}}>
      <div className="page-head">
        <div>
          <h1>Contactos</h1>
          <p>{filtered.length} de {N.contacts.length} · ordenado por última actividad</p>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="archive" size={14}/> Importar</button>
          <button className="btn primary"><Icon name="plus" size={14}/> Nuevo contacto</button>
        </div>
      </div>

      <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:14, flexWrap:'wrap'}}>
        <div className="seg">
          {['todos','cliente','oportunidad','lead','archivado'].map(f => (
            <button key={f} className={filter===f?'on':''} onClick={()=>setFilter(f)}>
              {f === 'todos' ? 'Todos' : f[0].toUpperCase()+f.slice(1)}
              <span style={{marginLeft:6, color:'var(--text-subtle)'}}>
                {f==='todos' ? N.contacts.length : N.contacts.filter(c=>c.status===f).length}
              </span>
            </button>
          ))}
        </div>
        <div style={{flex:1, maxWidth:280}}>
          <SearchInput placeholder="Buscar nombre, empresa…" value={q} onChange={setQ}/>
        </div>
        <button className="btn"><Icon name="filter" size={14}/> Filtros</button>
        <button className="btn"><Icon name="more" size={14}/></button>
      </div>

      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width:32}}><span className="chk"/></th>
              <th>Nombre</th>
              <th>Empresa</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Etiquetas</th>
              <th>Owner</th>
              <th>Valor</th>
              <th style={{textAlign:'right'}}>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className={sel.has(c.id)?'selected':''} onClick={()=>openContact(c.id)}>
                <td onClick={e=>{e.stopPropagation(); toggle(c.id);}}>
                  <span className={`chk ${sel.has(c.id)?'on':''}`}/>
                </td>
                <td>
                  <div className="row-pic">
                    <Avatar name={c.name} tone="accent"/>
                    <div>
                      <div className="cell-strong">{c.name}</div>
                      <div className="cell-mono">{c.email}</div>
                    </div>
                  </div>
                </td>
                <td>{c.company}</td>
                <td className="cell-muted">{c.role}</td>
                <td><StatusPill status={c.status}/></td>
                <td>
                  <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                    {c.tags.map(t => <span key={t} className="pill">{t}</span>)}
                  </div>
                </td>
                <td className="cell-muted">{c.owner}</td>
                <td className="cell-mono" style={{textAlign:'right'}}>{c.value ? `$${c.value.toLocaleString()}` : '—'}</td>
                <td className="cell-muted" style={{textAlign:'right'}}>{c.lastTouch}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CONTACT DETAIL ──────────────────────────────────────────
function ContactDetail({ id, go, back }) {
  const N = window.NORTE;
  const c = N.contacts.find(x => x.id === id) || N.contacts[0];
  const [tab, setTab] = useState('actividad');
  const deals = N.deals.filter(d => d.contact === c.id);
  const tasks = N.tasks.filter(t => t.contact === c.id);
  const acts  = N.activities.filter(a => a.contact === c.id);

  return (
    <div className="page" style={{maxWidth:1200, paddingTop:20}}>
      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:14, fontSize:12.5, color:'var(--text-muted)'}}>
        <button className="btn ghost sm" onClick={back}><Icon name="chev_left" size={14}/> Contactos</button>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <div style={{padding:'24px 24px 18px', display:'flex', gap:18, alignItems:'flex-start'}}>
          <Avatar name={c.name} size="xl" tone="accent"/>
          <div style={{flex:1}}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:4}}>
              <h1 style={{margin:0, fontSize:22, fontWeight:600, letterSpacing:'-0.02em'}}>{c.name}</h1>
              <StatusPill status={c.status}/>
            </div>
            <div style={{fontSize:13, color:'var(--text-muted)', display:'flex', gap:14, alignItems:'center'}}>
              <span style={{display:'inline-flex', gap:5, alignItems:'center'}}><Icon name="building" size={13}/> {c.company}</span>
              <span style={{display:'inline-flex', gap:5, alignItems:'center'}}><Icon name="pin" size={13}/> {c.city}</span>
              <span style={{display:'inline-flex', gap:5, alignItems:'center'}}>{c.role}</span>
            </div>
            <div style={{display:'flex', gap:6, marginTop:14}}>
              <button className="btn primary"><Icon name="mail" size={14}/> Enviar email</button>
              <button className="btn"><Icon name="phone" size={14}/> Llamar</button>
              <button className="btn"><Icon name="meet" size={14}/> Reunión</button>
              <button className="btn"><Icon name="edit" size={14}/> Nota</button>
              <button className="btn ghost icon"><Icon name="more" size={14}/></button>
            </div>
          </div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:12}}>
        <div className="card">
          <div style={{padding:'0 18px'}}>
            <div className="tabs">
              {['actividad','deals','tareas','archivos','emails'].map(t => (
                <div key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
                  {t[0].toUpperCase()+t.slice(1)}
                  {t==='deals' && <span style={{marginLeft:5, color:'var(--text-subtle)'}}>{deals.length}</span>}
                  {t==='tareas' && <span style={{marginLeft:5, color:'var(--text-subtle)'}}>{tasks.length}</span>}
                </div>
              ))}
            </div>
          </div>
          {tab === 'actividad' && (
            <div style={{padding:'14px 18px', display:'flex', flexDirection:'column', gap:14}}>
              <textarea className="input" placeholder="Añadir nota o registrar una actividad…" rows={2}/>
              <div style={{position:'relative'}}>
                <div style={{position:'absolute', left:14, top:8, bottom:8, width:1, background:'var(--border)'}}/>
                {acts.concat([
                  {id:'x1', kind:'note', who:'tú', text:`Primer contacto vía referido. ${c.name} respondió rápido y mostró interés.`, when:'hace 12 días', contact:c.id}
                ]).map(a => (
                  <div key={a.id} style={{display:'flex', gap:14, padding:'8px 0', alignItems:'flex-start'}}>
                    <div style={{width:28, height:28, borderRadius:'50%', background:'var(--bg-panel)', border:'1px solid var(--border)', display:'grid', placeItems:'center', color:'var(--text-muted)', flexShrink:0, zIndex:1}}>
                      <Icon name={{email_in:'mail',email_out:'send',call_out:'phone',meeting:'meet',note:'edit',invoice:'card'}[a.kind]||'doc'} size={13}/>
                    </div>
                    <div style={{flex:1, paddingTop:4}}>
                      <div style={{fontSize:12.5}}><b style={{fontWeight:500}}>{a.who}</b> <span style={{color:'var(--text-muted)'}}>· {a.when}</span></div>
                      <div style={{fontSize:12.5, color:'var(--text-muted)', marginTop:2, textWrap:'pretty'}}>{a.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === 'deals' && (
            <div style={{padding:8}}>
              {deals.length === 0 ? <div className="empty"><h4>Sin deals</h4><p>Crea uno para empezar a hacer seguimiento.</p></div> :
                deals.map(d => {
                  const stage = N.stages.find(s => s.id === d.stage);
                  return (
                    <div key={d.id} style={{padding:'12px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13, fontWeight:500}}>{d.title}</div>
                        <div style={{fontSize:11.5, color:'var(--text-muted)', marginTop:2}}>cierra {d.close} · prob {d.prob}%</div>
                      </div>
                      <span className="pill" style={{background:'transparent', border:'1px solid var(--border)'}}>
                        <span className="dot" style={{background:stage.color}}/>{stage.label}
                      </span>
                      <div style={{fontFamily:'var(--font-mono)', fontSize:13, fontWeight:500, minWidth:90, textAlign:'right'}}>${d.amount.toLocaleString()}</div>
                    </div>
                  );
                })
              }
            </div>
          )}
          {tab === 'tareas' && (
            <div>
              {tasks.length === 0 ? <div className="empty"><h4>Sin tareas</h4></div> :
                tasks.map((t,i)=><TaskRow key={t.id} task={t} divider={i<tasks.length-1}/>)
              }
            </div>
          )}
          {tab === 'archivos' && (
            <div className="card-pad" style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10}}>
              {['Brief 2026.pdf','Contrato v3.docx','Mood-board.fig'].map((f,i)=>(
                <div key={f} style={{border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:12}}>
                  <div className="ph-img" style={{aspectRatio:'4/3', marginBottom:10}}>preview</div>
                  <div style={{fontSize:12, fontWeight:500}}>{f}</div>
                  <div style={{fontSize:11, color:'var(--text-muted)', marginTop:2}}>hace {2+i} días · {120+i*40} kB</div>
                </div>
              ))}
            </div>
          )}
          {tab === 'emails' && (
            <div className="empty"><h4>Conecta tu inbox</h4><p>Vincula tu email para ver hilos automáticamente.</p>
              <button className="btn primary" style={{marginTop:14}}>Conectar Gmail</button>
            </div>
          )}
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          <div className="card card-pad">
            <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-subtle)', marginBottom:10}}>Detalles</div>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              <DetailRow icon="mail"  label="Email" value={c.email}/>
              <DetailRow icon="phone" label="Teléfono" value={c.phone}/>
              <DetailRow icon="building" label="Empresa" value={c.company}/>
              <DetailRow icon="pin"   label="Ciudad" value={c.city}/>
              <DetailRow icon="globe" label="Sitio web" value={c.company.toLowerCase().replace(/[^a-z]/g,'')+'.com'}/>
              <DetailRow icon="dollar" label="Valor cuenta" value={c.value ? `USD ${c.value.toLocaleString()}` : '—'}/>
            </div>
          </div>
          <div className="card card-pad" style={{background:'linear-gradient(135deg, var(--accent-soft), transparent 80%)', borderColor:'transparent'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
              <Icon name="sparkles" size={14} style={{color:'var(--accent)'}}/>
              <div style={{fontSize:12, fontWeight:600}}>Sugerencia IA</div>
            </div>
            <div style={{fontSize:12.5, color:'var(--text-muted)', textWrap:'pretty', lineHeight:1.5}}>
              {c.name.split(' ')[0]} no responde hace {c.lastTouch}. Antes solía contestar en 2 días. Sugiero un follow-up corto recordando el último entregable.
            </div>
            <button className="btn sm" style={{marginTop:10}}>Redactar follow-up</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const DetailRow = ({ icon, label, value }) => (
  <div style={{display:'flex', gap:10, alignItems:'flex-start'}}>
    <span style={{color:'var(--text-subtle)', marginTop:2}}><Icon name={icon} size={13}/></span>
    <div style={{flex:1, minWidth:0}}>
      <div style={{fontSize:11, color:'var(--text-subtle)', marginBottom:1}}>{label}</div>
      <div style={{fontSize:12.5, wordBreak:'break-word'}}>{value}</div>
    </div>
  </div>
);

// ─── PIPELINE ────────────────────────────────────────────────
function Pipeline() {
  const N = window.NORTE;
  const [view, setView] = useState('kanban');

  return (
    <>
      <div className="page-head" style={{padding:'24px 32px 14px', margin:0, maxWidth:'none'}}>
        <div>
          <h1>Pipeline</h1>
          <p>{N.deals.length} deals · USD {(N.deals.reduce((s,d)=>s+d.amount,0)/1000).toFixed(0)}k en total</p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className={view==='kanban'?'on':''} onClick={()=>setView('kanban')}>Kanban</button>
            <button className={view==='table'?'on':''} onClick={()=>setView('table')}>Tabla</button>
          </div>
          <button className="btn"><Icon name="filter" size={14}/> Esta Q</button>
          <button className="btn primary"><Icon name="plus" size={14}/> Nuevo deal</button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="kanban">
          {N.stages.map(stage => {
            const deals = N.deals.filter(d => d.stage === stage.id);
            const sum = deals.reduce((s,d)=>s+d.amount, 0);
            return (
              <div key={stage.id} className="kcol">
                <div className="kcol-head">
                  <div className="swatch" style={{background:stage.color}}/>
                  <h4>{stage.label}</h4>
                  <span className="count">{deals.length}</span>
                  <span className="sum">${(sum/1000).toFixed(0)}k</span>
                </div>
                <div className="kcol-body">
                  {deals.map(d => {
                    const c = N.contacts.find(x=>x.id===d.contact);
                    return (
                      <div key={d.id} className="kcard">
                        <div className="ktitle">{d.title}</div>
                        <div className="kmeta">
                          <Avatar name={c?.name} tone="accent"/>
                          <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{c?.company}</span>
                        </div>
                        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', borderTop:'1px solid var(--border)', paddingTop:7, marginTop:1}}>
                          <span className="kamt">${d.amount.toLocaleString()}</span>
                          <span style={{fontSize:11, color:'var(--text-muted)', display:'inline-flex', gap:4, alignItems:'center'}}>
                            <Icon name="clock" size={11}/> {d.close}
                          </span>
                        </div>
                        <div style={{display:'flex', alignItems:'center', gap:6}}>
                          <div style={{flex:1}}><Bar value={d.prob}/></div>
                          <span style={{fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)'}}>{d.prob}%</span>
                        </div>
                      </div>
                    );
                  })}
                  <button className="btn ghost sm" style={{justifyContent:'flex-start', height:28, color:'var(--text-subtle)'}}>
                    <Icon name="plus" size={12}/> Añadir deal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="page" style={{paddingTop:0, maxWidth:'none'}}>
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table className="tbl">
              <thead>
                <tr><th>Deal</th><th>Empresa</th><th>Etapa</th><th>Probabilidad</th><th style={{textAlign:'right'}}>Monto</th><th>Cierre</th><th>Owner</th></tr>
              </thead>
              <tbody>
                {N.deals.map(d => {
                  const c = N.contacts.find(x=>x.id===d.contact);
                  const s = N.stages.find(s=>s.id===d.stage);
                  return (
                    <tr key={d.id}>
                      <td className="cell-strong">{d.title}</td>
                      <td>{c?.company}</td>
                      <td><span className="pill" style={{background:'transparent', border:'1px solid var(--border)'}}><span className="dot" style={{background:s.color}}/>{s.label}</span></td>
                      <td><div style={{display:'flex', alignItems:'center', gap:8, width:160}}><Bar value={d.prob}/><span className="cell-mono" style={{minWidth:36, textAlign:'right'}}>{d.prob}%</span></div></td>
                      <td className="cell-mono" style={{textAlign:'right'}}>${d.amount.toLocaleString()}</td>
                      <td className="cell-muted">{d.close}</td>
                      <td className="cell-muted">{d.owner}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

Object.assign(window, { Dashboard, Contacts, ContactDetail, Pipeline });
