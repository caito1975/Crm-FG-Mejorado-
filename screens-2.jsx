// Norte CRM — screens part 2: Tasks, Calendar, Reports, Inbox, Settings

function Tasks() {
  const N = window.NORTE;
  const [groupBy, setGroupBy] = useState('due');
  const [tasks, setTasks] = useState(N.tasks);
  const toggle = id => setTasks(ts => ts.map(t => t.id===id ? {...t, done:!t.done}:t));

  const groups = useMemo(() => {
    if (groupBy === 'priority') {
      return [
        { label: 'Alta', items: tasks.filter(t=>t.priority==='alta' && !t.done) },
        { label: 'Media', items: tasks.filter(t=>t.priority==='media' && !t.done) },
        { label: 'Baja', items: tasks.filter(t=>t.priority==='baja' && !t.done) },
        { label: 'Completadas', items: tasks.filter(t=>t.done) },
      ];
    }
    return [
      { label: 'Hoy', items: tasks.filter(t=>!t.done && t.due.startsWith('hoy')) },
      { label: 'Mañana', items: tasks.filter(t=>!t.done && t.due.startsWith('mañana')) },
      { label: 'Esta semana', items: tasks.filter(t=>!t.done && !t.due.startsWith('hoy') && !t.due.startsWith('mañana') && t.due!=='completada') },
      { label: 'Completadas', items: tasks.filter(t=>t.done) },
    ];
  }, [tasks, groupBy]);

  return (
    <div className="page" style={{maxWidth:1100}}>
      <div className="page-head">
        <div>
          <h1>Tareas</h1>
          <p>{tasks.filter(t=>!t.done).length} pendientes · {tasks.filter(t=>t.done).length} completadas esta semana</p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className={groupBy==='due'?'on':''} onClick={()=>setGroupBy('due')}>Por fecha</button>
            <button className={groupBy==='priority'?'on':''} onClick={()=>setGroupBy('priority')}>Por prioridad</button>
          </div>
          <button className="btn primary"><Icon name="plus" size={14}/> Nueva tarea</button>
        </div>
      </div>

      <div className="card" style={{padding:'14px 18px', marginBottom:12, display:'flex', alignItems:'center', gap:10}}>
        <Icon name="plus" size={14} style={{color:'var(--text-subtle)'}}/>
        <input className="input" style={{border:'none', background:'transparent', height:24, padding:0}} placeholder="Añadir tarea rápida — escribe @ para asignar, # para etiqueta, fecha en lenguaje natural"/>
        <span className="kbd">Enter</span>
      </div>

      {groups.map(g => g.items.length > 0 && (
        <div key={g.label} style={{marginBottom:18}}>
          <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-subtle)', padding:'8px 4px'}}>
            {g.label} <span style={{color:'var(--border-strong)', fontWeight:400, marginLeft:6}}>{g.items.length}</span>
          </div>
          <div className="card" style={{padding:0}}>
            {g.items.map((t,i) => {
              const c = N.contacts.find(x=>x.id===t.contact);
              return (
                <div key={t.id} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom: i<g.items.length-1?'1px solid var(--border)':'none'}}>
                  <span className={`chk ${t.done?'on':''}`} onClick={()=>toggle(t.id)}/>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:450, textDecoration:t.done?'line-through':'none', color:t.done?'var(--text-muted)':'var(--text)'}}>{t.title}</div>
                    <div style={{fontSize:11.5, color:'var(--text-muted)', marginTop:2, display:'flex', gap:8, alignItems:'center'}}>
                      <Icon name="clock" size={11}/> {t.due}
                      {c && <><span>·</span><span>{c.name}</span><span>·</span><span>{c.company}</span></>}
                    </div>
                  </div>
                  <PriorityPill p={t.priority}/>
                  <Avatar name={c?.name} tone="accent"/>
                  <button className="btn ghost sm icon"><Icon name="more" size={14}/></button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Calendar() {
  const N = window.NORTE;
  const [view, setView] = useState('semana');
  const days = ['Lun 28','Mar 29','Mié 30','Jue 1','Vie 2','Sáb 3','Dom 4'];
  const events = [
    { day: 0, start: 9, end: 10, title: 'Standup interno', tone:'info' },
    { day: 0, start: 11, end: 12, title: 'Discovery — Atlas Studio', tone:'accent' },
    { day: 1, start: 10, end: 11.5, title: 'Café con Renata · Casa Lupe', tone:'warning' },
    { day: 2, start: 14, end: 15, title: 'Llamada Verde Salud', tone:'success' },
    { day: 3, start: 16, end: 17, title: 'Discovery Atlas (follow-up)', tone:'accent' },
    { day: 4, start: 9.5, end: 11, title: 'Brief Río Logística', tone:'info' },
    { day: 4, start: 13, end: 14, title: 'Almuerzo Diego', tone:'' },
  ];
  const hours = [8,9,10,11,12,13,14,15,16,17,18];
  const toneCol = (t) => ({
    accent:  ['var(--accent-soft)', 'var(--accent)'],
    info:    ['var(--info-soft)', 'var(--info)'],
    success: ['var(--success-soft)', 'var(--success)'],
    warning: ['var(--warning-soft)', 'oklch(48% 0.15 75)'],
    '':      ['var(--bg-sunken)', 'var(--text-muted)'],
  })[t || ''];

  return (
    <div className="page" style={{maxWidth:1280}}>
      <div className="page-head">
        <div>
          <h1>Calendario</h1>
          <p>Semana del 28 abr — 4 may · 7 reuniones</p>
        </div>
        <div className="page-actions">
          <button className="btn icon"><Icon name="chev_left" size={14}/></button>
          <button className="btn">Hoy</button>
          <button className="btn icon"><Icon name="chev_right" size={14}/></button>
          <div className="seg">
            <button>Día</button>
            <button className="on">Semana</button>
            <button>Mes</button>
          </div>
          <button className="btn primary"><Icon name="plus" size={14}/> Reunión</button>
        </div>
      </div>

      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'grid', gridTemplateColumns:'56px repeat(7, 1fr)', borderBottom:'1px solid var(--border)', background:'var(--bg-sunken)'}}>
          <div/>
          {days.map((d,i) => (
            <div key={d} style={{padding:'10px 12px', fontSize:12, fontWeight:500, borderLeft:'1px solid var(--border)', textAlign:'center'}}>
              <div style={{color:'var(--text-muted)', fontSize:11}}>{d.split(' ')[0]}</div>
              <div style={{fontSize:16, fontWeight:600, color:i===3?'var(--accent)':'var(--text)', marginTop:2}}>{d.split(' ')[1]}</div>
            </div>
          ))}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'56px repeat(7, 1fr)', position:'relative'}}>
          <div>
            {hours.map(h => (
              <div key={h} style={{height:48, padding:'4px 8px', textAlign:'right', fontSize:10.5, color:'var(--text-subtle)', fontFamily:'var(--font-mono)'}}>
                {h}:00
              </div>
            ))}
          </div>
          {days.map((d, di) => (
            <div key={d} style={{borderLeft:'1px solid var(--border)', position:'relative'}}>
              {hours.map(h => <div key={h} style={{height:48, borderBottom:'1px solid var(--border)'}}/>)}
              {events.filter(e=>e.day===di).map((e,i) => {
                const top = (e.start - hours[0]) * 48;
                const h = (e.end - e.start) * 48;
                const [bg, fg] = toneCol(e.tone);
                return (
                  <div key={i} style={{
                    position:'absolute', top, left:4, right:4, height:h-2,
                    background:bg, color:fg,
                    borderLeft:`3px solid ${fg}`,
                    borderRadius:'var(--r-sm)',
                    padding:'4px 8px', fontSize:11.5, fontWeight:500,
                    overflow:'hidden',
                  }}>
                    <div style={{fontFamily:'var(--font-mono)', fontSize:10, opacity:.8}}>{e.start}:00 — {e.end}:00</div>
                    <div style={{textWrap:'pretty', marginTop:1}}>{e.title}</div>
                  </div>
                );
              })}
              {di === 3 && (
                <div style={{position:'absolute', top: (10.3-hours[0])*48, left:0, right:0, height:1, background:'var(--accent)', zIndex:2}}>
                  <div style={{position:'absolute', left:-4, top:-3, width:7, height:7, borderRadius:'50%', background:'var(--accent)'}}/>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Reports() {
  const N = window.NORTE;
  return (
    <div className="page" style={{maxWidth:1400}}>
      <div className="page-head">
        <div>
          <h1>Reportes</h1>
          <p>Q2 2026 · trimestre en curso · actualizado hace 5 min</p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button>Q1</button>
            <button className="on">Q2</button>
            <button>Q3</button>
            <button>YTD</button>
          </div>
          <button className="btn"><Icon name="archive" size={14}/> Exportar</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:12}}>
        <KPI lbl="MRR" val="USD 64k" delta="+18%" up/>
        <KPI lbl="ARR proyectado" val="USD 768k" delta="+22%" up/>
        <KPI lbl="Deals ganados" val="14" delta="+3" up/>
        <KPI lbl="Costo de adq." val="USD 412" delta="-8%" up/>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:12, marginBottom:12}}>
        <div className="card">
          <div className="card-head">
            <h3>Pipeline por etapa</h3>
            <div className="seg">
              <button className="on">Monto</button>
              <button>Cantidad</button>
            </div>
          </div>
          <div style={{padding:'18px 20px 22px'}}>
            <FunnelChart stages={N.stages} deals={N.deals}/>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Performance por owner</h3></div>
          <div style={{padding:'12px 18px'}}>
            {[
              { name:'Tú', deals:7, won:'USD 184k', rate:71, tone:'accent' },
              { name:'Ana López', deals:3, won:'USD 24k', rate:33, tone:'info' },
              { name:'Pablo Yánez', deals:4, won:'USD 92k', rate:50, tone:'success' },
            ].map(p => (
              <div key={p.name} style={{padding:'10px 0', borderBottom:'1px solid var(--border)'}}>
                <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
                  <Avatar name={p.name} tone={p.tone}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13, fontWeight:500}}>{p.name}</div>
                    <div style={{fontSize:11.5, color:'var(--text-muted)'}}>{p.deals} deals · {p.won} ganado</div>
                  </div>
                  <span className="cell-mono" style={{fontSize:12}}>{p.rate}%</span>
                </div>
                <Bar value={p.rate}/>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12}}>
        <div className="card">
          <div className="card-head"><h3>Cohort retention</h3></div>
          <div className="card-pad"><CohortGrid/></div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Mix por industria</h3></div>
          <div className="card-pad" style={{display:'flex', flexDirection:'column', gap:10}}>
            {[
              {l:'Retail', v:32, c:'oklch(58% 0.155 280)'},
              {l:'Servicios', v:24, c:'oklch(65% 0.13 230)'},
              {l:'Food & bev', v:18, c:'oklch(70% 0.13 75)'},
              {l:'Salud', v:14, c:'oklch(60% 0.13 155)'},
              {l:'Otros', v:12, c:'oklch(70% 0.04 250)'},
            ].map(x => (
              <div key={x.l}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4}}>
                  <span>{x.l}</span><span style={{color:'var(--text-muted)'}}>{x.v}%</span>
                </div>
                <div className="bar"><span style={{width:`${x.v*2.5}%`, background:x.c}}/></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Ciclo de venta</h3></div>
          <div className="card-pad">
            <div style={{fontSize:32, fontWeight:600, letterSpacing:'-0.02em'}}>14 <span style={{fontSize:14, color:'var(--text-muted)'}}>días</span></div>
            <div className="delta up" style={{fontSize:12, marginTop:2}}><Icon name="arrow_dn" size={11}/> 2 días vs trimestre anterior</div>
            <div className="divider"/>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:12}}>
              <div><div style={{color:'var(--text-muted)'}}>Lead → Calificado</div><div style={{fontWeight:500, marginTop:2}}>3.2 d</div></div>
              <div><div style={{color:'var(--text-muted)'}}>Calificado → Propuesta</div><div style={{fontWeight:500, marginTop:2}}>5.1 d</div></div>
              <div><div style={{color:'var(--text-muted)'}}>Propuesta → Negociación</div><div style={{fontWeight:500, marginTop:2}}>4.0 d</div></div>
              <div><div style={{color:'var(--text-muted)'}}>Negociación → Ganado</div><div style={{fontWeight:500, marginTop:2}}>1.7 d</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const KPI = ({ lbl, val, delta, up }) => (
  <div className="card stat">
    <div className="lbl">{lbl}</div>
    <div className="val">{val}</div>
    <div className={`delta ${up?'up':'down'}`}><Icon name={up?'arrow_up':'arrow_dn'} size={11}/> {delta}</div>
  </div>
);

function FunnelChart({ stages, deals }) {
  const totals = stages.map(s => ({
    s, n: deals.filter(d=>d.stage===s.id).length,
    amt: deals.filter(d=>d.stage===s.id).reduce((a,d)=>a+d.amount,0),
  }));
  const max = Math.max(...totals.map(t=>t.amt));
  return (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      {totals.map(t => (
        <div key={t.s.id} style={{display:'flex', alignItems:'center', gap:14}}>
          <div style={{width:110, fontSize:12.5, fontWeight:500, display:'flex', alignItems:'center', gap:8}}>
            <span style={{width:8, height:8, borderRadius:2, background:t.s.color}}/>
            {t.s.label}
          </div>
          <div style={{flex:1, height:24, background:'var(--bg-sunken)', borderRadius:'var(--r-sm)', overflow:'hidden', position:'relative'}}>
            <div style={{width:`${(t.amt/max)*100}%`, height:'100%', background:`linear-gradient(90deg, ${t.s.color}, ${t.s.color} 80%, transparent)`, opacity:.85}}/>
            <div style={{position:'absolute', left:10, top:0, height:'100%', display:'flex', alignItems:'center', fontSize:11.5, color:'white', fontWeight:500, mixBlendMode:'difference'}}>{t.n} deals</div>
          </div>
          <div style={{fontFamily:'var(--font-mono)', fontSize:12.5, fontWeight:500, minWidth:80, textAlign:'right'}}>${(t.amt/1000).toFixed(0)}k</div>
        </div>
      ))}
    </div>
  );
}

function CohortGrid() {
  const cohorts = ['ene','feb','mar','abr','may','jun'];
  // retention table — values 0..100
  const data = [
    [100, 92, 88, 84, 80, 78],
    [100, 88, 82, 78, 76, null],
    [100, 90, 86, 82, null, null],
    [100, 94, 88, null, null, null],
    [100, 90, null, null, null, null],
    [100, null, null, null, null, null],
  ];
  return (
    <div style={{display:'grid', gridTemplateColumns:`auto repeat(${cohorts.length}, 1fr)`, gap:2, fontSize:11}}>
      <div/>
      {cohorts.map((m,i) => <div key={i} style={{textAlign:'center', color:'var(--text-subtle)', padding:4}}>M{i}</div>)}
      {data.map((row,i)=>(
        <React.Fragment key={i}>
          <div style={{padding:4, color:'var(--text-muted)', fontFamily:'var(--font-mono)'}}>{cohorts[i]}</div>
          {row.map((v,j) => v == null ? <div key={j}/> : (
            <div key={j} style={{
              padding:'6px 4px', textAlign:'center',
              background:`oklch(94% ${0.005 + v/100 * 0.05} 280 / ${v/100})`,
              color: v > 60 ? 'var(--accent)' : 'var(--text-muted)',
              borderRadius:3, fontWeight:500, fontFamily:'var(--font-mono)',
            }}>{v}%</div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function Inbox() {
  const N = window.NORTE;
  const [selected, setSelected] = useState('m01');
  const [folder, setFolder] = useState('inbox');
  const msg = N.inbox.find(m => m.id === selected) || N.inbox[0];
  const c = N.contacts.find(x => x.name === msg.from);

  return (
    <div style={{display:'grid', gridTemplateColumns:'180px 360px 1fr', height:'100%', overflow:'hidden'}}>
      <div style={{borderRight:'1px solid var(--border)', padding:'14px 8px', background:'var(--bg-sunken)'}}>
        <button className="btn primary" style={{width:'100%', marginBottom:12, justifyContent:'center'}}>
          <Icon name="edit" size={14}/> Componer
        </button>
        {[
          {id:'inbox', icon:'inbox', label:'Bandeja', n:3},
          {id:'star', icon:'star', label:'Destacados', n:3},
          {id:'sent', icon:'send', label:'Enviados'},
          {id:'archive', icon:'archive', label:'Archivados'},
        ].map(f => (
          <div key={f.id} className={`nav-item ${folder===f.id?'active':''}`} onClick={()=>setFolder(f.id)}>
            <span className="nav-ico"><Icon name={f.icon} size={14}/></span>
            <span>{f.label}</span>
            {f.n && <span className="nav-count">{f.n}</span>}
          </div>
        ))}
        <div className="nav-section">Etiquetas</div>
        {[
          {l:'cliente',c:'var(--success)'},
          {l:'propuesta',c:'var(--accent)'},
          {l:'prioridad',c:'var(--danger)'},
          {l:'facturación',c:'var(--info)'},
        ].map(t => (
          <div key={t.l} className="nav-item">
            <span style={{width:8, height:8, borderRadius:2, background:t.c, marginLeft:4}}/>
            <span style={{textTransform:'capitalize'}}>{t.l}</span>
          </div>
        ))}
      </div>

      <div style={{borderRight:'1px solid var(--border)', overflowY:'auto'}}>
        <div style={{padding:'14px 14px 10px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{fontSize:14, fontWeight:600}}>Bandeja</div>
          <div style={{fontSize:11.5, color:'var(--text-muted)'}}>{N.inbox.filter(m=>m.unread).length} sin leer</div>
        </div>
        {N.inbox.map(m => (
          <div key={m.id} onClick={()=>setSelected(m.id)} style={{
            padding:'12px 14px',
            borderBottom:'1px solid var(--border)',
            cursor:'default',
            background: m.id===selected ? 'var(--bg-active)' : (m.unread ? 'var(--bg-panel)' : 'var(--bg-sunken)'),
            borderLeft: m.id===selected ? '3px solid var(--accent)' : '3px solid transparent',
            paddingLeft: m.id===selected ? 11 : 14,
          }}>
            <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:3}}>
              {m.unread && <span style={{width:6, height:6, borderRadius:'50%', background:'var(--accent)', flexShrink:0}}/>}
              <div style={{fontSize:13, fontWeight:m.unread?600:500, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{m.from}</div>
              <div style={{fontSize:11, color:'var(--text-subtle)'}}>{m.when}</div>
              {m.starred && <Icon name="star_fill" size={12} style={{color:'oklch(70% 0.13 75)'}}/>}
            </div>
            <div style={{fontSize:12.5, fontWeight:m.unread?500:400, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{m.subject}</div>
            <div style={{fontSize:11.5, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{m.preview}</div>
            <div style={{display:'flex', gap:4, marginTop:6}}>
              {m.labels.map(l => <span key={l} className="pill" style={{height:16, fontSize:10, padding:'0 6px'}}>{l}</span>)}
            </div>
          </div>
        ))}
      </div>

      <div style={{display:'flex', flexDirection:'column', overflow:'hidden'}}>
        <div style={{padding:'14px 22px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:16, fontWeight:600, letterSpacing:'-0.01em'}}>{msg.subject}</div>
            <div style={{fontSize:11.5, color:'var(--text-muted)', marginTop:2}}>{msg.labels.join(' · ')}</div>
          </div>
          <button className="btn"><Icon name="reply" size={13}/> Responder</button>
          <button className="btn icon"><Icon name="archive" size={13}/></button>
          <button className="btn icon"><Icon name="more" size={13}/></button>
        </div>
        <div style={{flex:1, overflowY:'auto', padding:'18px 22px'}}>
          <div style={{display:'flex', gap:12, marginBottom:14}}>
            <Avatar name={msg.from} size="lg" tone="accent"/>
            <div style={{flex:1}}>
              <div style={{fontSize:13, fontWeight:500}}>{msg.from}</div>
              <div style={{fontSize:11.5, color:'var(--text-muted)'}}>para tú@estudionorte.com · {msg.when}</div>
            </div>
            {c && <button className="btn sm">Ver contacto</button>}
          </div>
          <div style={{fontSize:13.5, lineHeight:1.65, color:'var(--text)', textWrap:'pretty', maxWidth:680}}>
            <p>Hola,</p>
            <p>{msg.preview} Pasamos el draft a legal y volvieron con dos puntos para ajustar antes de firmar:</p>
            <ol style={{paddingLeft:20, margin:'12px 0'}}>
              <li style={{marginBottom:6}}>Cláusula 4.b — necesitamos especificar el alcance de revisiones (sugerimos máximo 3 rondas por entregable).</li>
              <li>Anexo de marca — incluir el guideline actualizado v3.2 que les pasamos en febrero.</li>
            </ol>
            <p>Si lo podemos cerrar esta semana, ya estaríamos en condiciones de arrancar el 12 de mayo como hablamos.</p>
            <p style={{marginTop:18, color:'var(--text-muted)'}}>Saludos,<br/>{msg.from.split(' ')[0]}</p>
          </div>

          <div className="card" style={{marginTop:24, background:'linear-gradient(135deg, var(--accent-soft), transparent 80%)', borderColor:'transparent'}}>
            <div style={{padding:'14px 16px', display:'flex', gap:12, alignItems:'flex-start'}}>
              <Icon name="sparkles" size={16} style={{color:'var(--accent)', marginTop:2}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12.5, fontWeight:500, marginBottom:4}}>Sugerencia de respuesta</div>
                <div style={{fontSize:12.5, color:'var(--text-muted)', textWrap:'pretty', lineHeight:1.55}}>
                  "Perfecto, Lucía. Acepto el límite de 3 rondas y te paso el guideline v3.2 hoy mismo. ¿Te sirve firmar viernes a primera hora?"
                </div>
                <div style={{display:'flex', gap:6, marginTop:10}}>
                  <button className="btn sm primary">Usar y editar</button>
                  <button className="btn sm">Otra opción</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{borderTop:'1px solid var(--border)', padding:'14px 22px', background:'var(--bg-sunken)'}}>
          <div className="card" style={{padding:'10px 12px'}}>
            <textarea className="input" style={{border:'none', minHeight:60, padding:0}} placeholder="Escribir respuesta…"/>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8}}>
              <div style={{display:'flex', gap:4}}>
                <button className="btn ghost sm icon"><Icon name="link" size={13}/></button>
                <button className="btn ghost sm icon"><Icon name="doc" size={13}/></button>
                <button className="btn ghost sm icon"><Icon name="sparkles" size={13}/></button>
              </div>
              <button className="btn primary sm"><Icon name="send" size={13}/> Enviar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Settings() {
  const N = window.NORTE;
  const [section, setSection] = useState('workspace');
  const sections = [
    { id:'workspace', label:'Workspace', icon:'building' },
    { id:'team',      label:'Equipo',    icon:'team' },
    { id:'pipeline',  label:'Etapas del pipeline', icon:'pipeline' },
    { id:'integrations', label:'Integraciones', icon:'link' },
    { id:'billing',   label:'Facturación', icon:'card' },
    { id:'api',       label:'API y webhooks', icon:'cmd' },
  ];
  return (
    <div style={{display:'grid', gridTemplateColumns:'220px 1fr', height:'100%', overflow:'hidden'}}>
      <div style={{borderRight:'1px solid var(--border)', padding:14, background:'var(--bg-sunken)'}}>
        <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-subtle)', padding:'8px 8px'}}>Configuración</div>
        {sections.map(s => (
          <div key={s.id} className={`nav-item ${section===s.id?'active':''}`} onClick={()=>setSection(s.id)}>
            <span className="nav-ico"><Icon name={s.icon} size={14}/></span>
            {s.label}
          </div>
        ))}
      </div>

      <div style={{overflowY:'auto'}}>
        <div className="page" style={{maxWidth:760}}>
          {section === 'workspace' && (
            <>
              <div className="page-head"><div><h1>Workspace</h1><p>Apariencia general y datos del estudio</p></div></div>
              <div className="card card-pad" style={{display:'flex', flexDirection:'column', gap:14}}>
                <Field label="Nombre del workspace" value="Estudio Norte"/>
                <Field label="URL" value="estudionorte.norte.app"/>
                <div className="field">
                  <label>Logo</label>
                  <div style={{display:'flex', gap:10, alignItems:'center'}}>
                    <div style={{width:48, height:48, borderRadius:10, background:'linear-gradient(135deg, var(--accent), oklch(48% 0.18 310))', color:'white', display:'grid', placeItems:'center', fontWeight:700, fontSize:18}}>EN</div>
                    <button className="btn">Subir</button>
                  </div>
                </div>
                <Field label="Zona horaria" value="América / Buenos Aires (GMT-3)" select/>
                <Field label="Moneda principal" value="USD — dólar estadounidense" select/>
              </div>
            </>
          )}
          {section === 'team' && (
            <>
              <div className="page-head">
                <div><h1>Equipo</h1><p>{N.team.length} miembros · 2 invitaciones pendientes</p></div>
                <button className="btn primary"><Icon name="plus" size={14}/> Invitar</button>
              </div>
              <div className="card" style={{padding:0, overflow:'hidden'}}>
                <table className="tbl">
                  <thead><tr><th>Miembro</th><th>Rol</th><th>Email</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {N.team.map(t => (
                      <tr key={t.id}>
                        <td>
                          <div className="row-pic">
                            <Avatar name={t.name} tone={t.tone}/>
                            <div className="cell-strong">{t.name}</div>
                          </div>
                        </td>
                        <td>{t.role}</td>
                        <td className="cell-mono">{t.email}</td>
                        <td><span className="pill success">Activo</span></td>
                        <td><button className="btn ghost sm icon"><Icon name="more" size={14}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {section === 'pipeline' && (
            <>
              <div className="page-head"><div><h1>Etapas del pipeline</h1><p>Personaliza el flujo de venta · arrastra para reordenar</p></div></div>
              <div className="card" style={{padding:0}}>
                {N.stages.map((s,i) => (
                  <div key={s.id} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:i<N.stages.length-1?'1px solid var(--border)':'none'}}>
                    <span style={{color:'var(--text-subtle)', cursor:'grab'}}><Icon name="drag" size={14}/></span>
                    <span style={{width:12, height:12, borderRadius:3, background:s.color}}/>
                    <div style={{flex:1, fontSize:13, fontWeight:500}}>{s.label}</div>
                    <span className="cell-mono" style={{color:'var(--text-muted)', fontSize:12}}>prob. ~{[20,40,55,75,100][i]}%</span>
                    <button className="btn ghost sm"><Icon name="edit" size={13}/></button>
                  </div>
                ))}
                <div style={{padding:12}}><button className="btn ghost sm"><Icon name="plus" size={13}/> Añadir etapa</button></div>
              </div>
            </>
          )}
          {section === 'integrations' && (
            <>
              <div className="page-head"><div><h1>Integraciones</h1><p>Conecta tus herramientas favoritas</p></div></div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10}}>
                {[
                  {n:'Gmail', d:'Sincroniza hilos y eventos.', on:true},
                  {n:'Google Calendar', d:'Importa y crea reuniones.', on:true},
                  {n:'Slack', d:'Notificaciones de pipeline.', on:false},
                  {n:'Stripe', d:'Pagos y facturas.', on:true},
                  {n:'Notion', d:'Sincroniza notas y briefs.', on:false},
                  {n:'Figma', d:'Adjunta archivos a contactos.', on:false},
                ].map(x => (
                  <div key={x.n} className="card card-pad" style={{display:'flex', alignItems:'center', gap:12}}>
                    <div style={{width:36, height:36, borderRadius:8, background:'var(--bg-sunken)', border:'1px solid var(--border)', display:'grid', placeItems:'center', fontWeight:600, fontSize:13}}>{x.n[0]}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13, fontWeight:500}}>{x.n}</div>
                      <div style={{fontSize:11.5, color:'var(--text-muted)'}}>{x.d}</div>
                    </div>
                    <span className={`pill ${x.on?'success':''}`}><span className="dot"/>{x.on?'Conectado':'Conectar'}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {section === 'billing' && (
            <>
              <div className="page-head"><div><h1>Facturación</h1><p>Plan, uso y método de pago</p></div></div>
              <div className="card card-pad" style={{marginBottom:12, display:'flex', alignItems:'center', gap:14}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--accent)'}}>Plan Studio</div>
                  <div style={{fontSize:22, fontWeight:600, letterSpacing:'-0.02em', marginTop:2}}>USD 39 / mes</div>
                  <div style={{fontSize:12, color:'var(--text-muted)', marginTop:4}}>Hasta 5 miembros, contactos ilimitados, IA básica</div>
                </div>
                <button className="btn">Cambiar plan</button>
              </div>
              <div className="card card-pad">
                <div style={{fontSize:13, fontWeight:500, marginBottom:10}}>Próximo cargo</div>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <div style={{fontSize:12, color:'var(--text-muted)'}}>1 de junio · Visa •••• 4242</div>
                  <div style={{fontFamily:'var(--font-mono)', fontSize:14, fontWeight:500}}>USD 39.00</div>
                </div>
              </div>
            </>
          )}
          {section === 'api' && (
            <>
              <div className="page-head"><div><h1>API y webhooks</h1><p>Automatiza con código</p></div></div>
              <div className="card card-pad">
                <Field label="API key" value="nrt_live_8g2k_*****************"/>
                <div className="divider"/>
                <div style={{fontSize:13, fontWeight:500, marginBottom:8}}>Webhooks activos</div>
                <div style={{fontFamily:'var(--font-mono)', fontSize:11.5, color:'var(--text-muted)', background:'var(--bg-sunken)', padding:10, borderRadius:'var(--r-sm)', border:'1px solid var(--border)'}}>
                  POST  https://hooks.estudionorte.com/crm/deal-won<br/>
                  POST  https://hooks.estudionorte.com/crm/contact-created
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, value, select }) => (
  <div className="field">
    <label>{label}</label>
    <div className="input" style={{display:'flex', alignItems:'center'}}>
      <span style={{flex:1}}>{value}</span>
      {select && <Icon name="chev_down" size={13} style={{color:'var(--text-subtle)'}}/>}
    </div>
  </div>
);

Object.assign(window, { Tasks, Calendar, Reports, Inbox, Settings });
