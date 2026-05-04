// Norte CRM — Forecast por vendedor

function ForecastView() {
  const N = window.NORTE;
  const team = N.team.filter(t => t.status === 'activo');
  const [scenario, setScenario] = useState('committed');
  const [period, setPeriod] = useState('Q2');

  // build forecast per seller
  const ownerMap = { 'u_tu':'tu','u_ana':'Ana','u_pablo':'Pablo','u_lia':'Lía','u_die':'Diego' };
  const forecast = team.map(m => {
    const myDeals = N.deals.filter(d => d.owner === ownerMap[m.id]);
    const won       = myDeals.filter(d => d.stage === 'cerrado').reduce((s,d)=>s+d.amount, 0);
    const commit    = myDeals.filter(d => d.stage === 'negocia').reduce((s,d)=>s+d.amount * (d.prob/100), 0);
    const probable  = myDeals.filter(d => d.stage === 'propuesta').reduce((s,d)=>s+d.amount * (d.prob/100), 0);
    const pipeline  = myDeals.filter(d => ['lead','qual'].includes(d.stage)).reduce((s,d)=>s+d.amount * (d.prob/100), 0);
    const best      = won + commit + probable + pipeline;
    const expected  = won + commit + probable * 0.7;
    const worst     = won + commit * 0.8;
    const proj = scenario === 'best' ? best : scenario === 'worst' ? worst : expected;
    return { ...m, won, commit, probable, pipeline, best, expected, worst, proj, attain: m.quota?Math.round((proj/m.quota)*100):0, deals: myDeals };
  });

  const totalQuota = forecast.reduce((s,m)=>s+m.quota, 0);
  const totalProj  = forecast.reduce((s,m)=>s+m.proj, 0);
  const totalWon   = forecast.reduce((s,m)=>s+m.won, 0);
  const totalCommit = forecast.reduce((s,m)=>s+m.commit, 0);
  const totalProb  = forecast.reduce((s,m)=>s+m.probable, 0);
  const totalGap   = totalQuota - totalProj;
  const teamAttain = totalQuota ? Math.round((totalProj/totalQuota)*100) : 0;

  return (
    <div style={{display:'flex', flexDirection:'column', gap:14}}>
      {/* Top summary */}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{padding:'18px 20px', display:'flex', alignItems:'center', gap:16, borderBottom:'1px solid var(--border)'}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-subtle)'}}>Forecast {period} 2026 · escenario {scenario}</div>
            <div style={{display:'flex', alignItems:'baseline', gap:14, marginTop:6}}>
              <div style={{fontSize:28, fontWeight:600, letterSpacing:'-0.02em', fontFamily:'var(--font-mono)'}}>USD {(totalProj/1000).toFixed(0)}k</div>
              <div style={{fontSize:13, color:'var(--text-muted)'}}>de cuota USD {(totalQuota/1000).toFixed(0)}k</div>
              <span className={`pill ${teamAttain>=100?'success':teamAttain>=80?'accent':'warning'}`}><span className="dot"/>{teamAttain}% del objetivo</span>
              {totalGap > 0 && <span style={{fontSize:12, color:'var(--text-muted)'}}>· faltan USD {(totalGap/1000).toFixed(0)}k</span>}
            </div>
          </div>
          <div className="seg">
            <button className={scenario==='worst'?'on':''} onClick={()=>setScenario('worst')}>Pesimista</button>
            <button className={scenario==='committed'?'on':''} onClick={()=>setScenario('committed')}>Esperado</button>
            <button className={scenario==='best'?'on':''} onClick={()=>setScenario('best')}>Optimista</button>
          </div>
          <div className="seg">
            {['Q2','Q3','YTD'].map(p => <button key={p} className={period===p?'on':''} onClick={()=>setPeriod(p)}>{p}</button>)}
          </div>
        </div>

        {/* Stacked bar */}
        <div style={{padding:'18px 20px'}}>
          <StackedForecastBar
            won={totalWon} commit={totalCommit} probable={totalProb}
            pipeline={forecast.reduce((s,m)=>s+m.pipeline, 0)}
            quota={totalQuota}
          />
        </div>
      </div>

      {/* Per-seller forecast */}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div className="card-head">
          <div><h3>Forecast por vendedor</h3><div className="sub">Comparado contra cuota individual · ordenado por logro</div></div>
          <button className="btn sm"><Icon name="archive" size={13}/> Exportar</button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>Ganado</th>
              <th>Compromiso</th>
              <th>Probable</th>
              <th>Pipeline</th>
              <th style={{width:280}}>Forecast vs cuota</th>
              <th style={{textAlign:'right'}}>Logro proy.</th>
              <th style={{textAlign:'right'}}>Gap</th>
            </tr>
          </thead>
          <tbody>
            {forecast.sort((a,b)=>b.attain-a.attain).map(m => (
              <tr key={m.id}>
                <td>
                  <div className="row-pic">
                    <Avatar name={m.name} tone={m.tone}/>
                    <div>
                      <div className="cell-strong">{m.name}</div>
                      <div style={{fontSize:11, color:'var(--text-muted)'}}>{m.role} · {m.region}</div>
                    </div>
                  </div>
                </td>
                <td className="cell-mono" style={{color:'var(--success)'}}>${(m.won/1000).toFixed(0)}k</td>
                <td className="cell-mono">${(m.commit/1000).toFixed(0)}k</td>
                <td className="cell-mono" style={{color:'var(--text-muted)'}}>${(m.probable/1000).toFixed(0)}k</td>
                <td className="cell-mono" style={{color:'var(--text-subtle)'}}>${(m.pipeline/1000).toFixed(0)}k</td>
                <td>
                  <SellerForecastRow won={m.won} commit={m.commit} probable={m.probable} pipeline={m.pipeline} quota={m.quota} proj={m.proj}/>
                </td>
                <td className="cell-mono" style={{textAlign:'right', color: m.attain>=100?'var(--success)':m.attain>=70?'var(--text)':'var(--danger)', fontWeight:500}}>{m.attain}%</td>
                <td className="cell-mono" style={{textAlign:'right', color:'var(--text-muted)'}}>
                  {m.proj >= m.quota ? `+$${((m.proj-m.quota)/1000).toFixed(0)}k` : `-$${((m.quota-m.proj)/1000).toFixed(0)}k`}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{background:'var(--bg-sunken)', fontWeight:500}}>
              <td>Total equipo</td>
              <td className="cell-mono">${(totalWon/1000).toFixed(0)}k</td>
              <td className="cell-mono">${(totalCommit/1000).toFixed(0)}k</td>
              <td className="cell-mono">${(totalProb/1000).toFixed(0)}k</td>
              <td className="cell-mono">${(forecast.reduce((s,m)=>s+m.pipeline,0)/1000).toFixed(0)}k</td>
              <td><Bar value={Math.min(teamAttain,100)}/></td>
              <td className="cell-mono" style={{textAlign:'right', fontWeight:600}}>{teamAttain}%</td>
              <td className="cell-mono" style={{textAlign:'right'}}>{totalGap>0?`-$${(totalGap/1000).toFixed(0)}k`:`+$${((-totalGap)/1000).toFixed(0)}k`}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend + insight */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div className="card card-pad">
          <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-subtle)', marginBottom:10}}>Cómo se calcula</div>
          <div style={{display:'flex', flexDirection:'column', gap:8, fontSize:12.5}}>
            <LegendItem c="var(--success)" l="Ganado" d="Deals cerrados (100%)"/>
            <LegendItem c="var(--accent)" l="Compromiso" d="Deals en negociación, ponderados por probabilidad"/>
            <LegendItem c="oklch(70% 0.13 280)" l="Probable" d="Propuestas activas, ponderadas (×0.7 en escenario esperado)"/>
            <LegendItem c="var(--border-strong)" l="Pipeline" d="Leads y calificados, ponderados por probabilidad"/>
          </div>
        </div>
        <div className="card card-pad" style={{background:'linear-gradient(135deg, var(--accent-soft), transparent 80%)', borderColor:'transparent'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
            <Icon name="sparkles" size={14} style={{color:'var(--accent)'}}/>
            <div style={{fontSize:12, fontWeight:600}}>Insight del forecast</div>
          </div>
          <div style={{fontSize:12.5, color:'var(--text-muted)', textWrap:'pretty', lineHeight:1.55}}>
            Con escenario esperado, el equipo cierra <b style={{color:'var(--text)'}}>{teamAttain}%</b> de la cuota. <b style={{color:'var(--text)'}}>Ana</b> y <b style={{color:'var(--text)'}}>Lía</b> están bajo el 60% — sugiero reasignar 1 deal grande de pipeline propio o aumentar coaching esta semana.
          </div>
          <button className="btn sm primary" style={{marginTop:10}}>Plan de acción</button>
        </div>
      </div>
    </div>
  );
}

const LegendItem = ({ c, l, d }) => (
  <div style={{display:'flex', alignItems:'flex-start', gap:8}}>
    <span style={{width:10, height:10, borderRadius:2, background:c, marginTop:4, flexShrink:0}}/>
    <div><b style={{fontWeight:500}}>{l}</b> <span style={{color:'var(--text-muted)'}}>· {d}</span></div>
  </div>
);

function StackedForecastBar({ won, commit, probable, pipeline, quota }) {
  const total = won + commit + probable + pipeline;
  const max = Math.max(total, quota) * 1.05;
  const seg = (v, c) => ({ width: `${(v/max)*100}%`, background: c });
  const quotaPos = (quota/max)*100;
  return (
    <div>
      <div style={{height:32, background:'var(--bg-sunken)', borderRadius:'var(--r-sm)', display:'flex', overflow:'hidden', position:'relative', border:'1px solid var(--border)'}}>
        <div style={{...seg(won,'var(--success)')}}/>
        <div style={{...seg(commit,'var(--accent)')}}/>
        <div style={{...seg(probable,'oklch(70% 0.13 280)'), opacity:.7}}/>
        <div style={{...seg(pipeline,'var(--border-strong)'), opacity:.6}}/>
        {/* quota marker */}
        <div style={{position:'absolute', left:`${quotaPos}%`, top:-4, bottom:-4, width:0, borderLeft:'2px dashed var(--text-muted)'}}>
          <div style={{position:'absolute', left:6, top:-2, fontSize:10.5, color:'var(--text-muted)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap', background:'var(--bg-panel)', padding:'1px 5px', borderRadius:3, border:'1px solid var(--border)'}}>
            cuota ${(quota/1000).toFixed(0)}k
          </div>
        </div>
      </div>
      <div style={{display:'flex', gap:18, marginTop:14, fontSize:12, flexWrap:'wrap'}}>
        <Legend c="var(--success)" l="Ganado" v={`$${(won/1000).toFixed(0)}k`}/>
        <Legend c="var(--accent)" l="Compromiso" v={`$${(commit/1000).toFixed(0)}k`}/>
        <Legend c="oklch(70% 0.13 280)" l="Probable" v={`$${(probable/1000).toFixed(0)}k`}/>
        <Legend c="var(--border-strong)" l="Pipeline" v={`$${(pipeline/1000).toFixed(0)}k`}/>
      </div>
    </div>
  );
}

const Legend = ({ c, l, v }) => (
  <div style={{display:'inline-flex', alignItems:'center', gap:6}}>
    <span style={{width:10, height:10, borderRadius:2, background:c}}/>
    <span style={{color:'var(--text-muted)'}}>{l}</span>
    <span style={{fontFamily:'var(--font-mono)', fontWeight:500}}>{v}</span>
  </div>
);

function SellerForecastRow({ won, commit, probable, pipeline, quota, proj }) {
  const max = Math.max(won+commit+probable+pipeline, quota) * 1.02;
  const seg = (v, c, op=1) => <div style={{width:`${(v/max)*100}%`, background:c, opacity:op, height:'100%'}}/>;
  const quotaPos = (quota/max)*100;
  return (
    <div style={{position:'relative'}}>
      <div style={{height:18, background:'var(--bg-sunken)', borderRadius:4, display:'flex', overflow:'hidden', border:'1px solid var(--border)'}}>
        {seg(won, 'var(--success)')}
        {seg(commit, 'var(--accent)')}
        {seg(probable, 'oklch(70% 0.13 280)', .7)}
        {seg(pipeline, 'var(--border-strong)', .6)}
      </div>
      <div style={{position:'absolute', left:`${quotaPos}%`, top:-2, bottom:-2, width:0, borderLeft:'2px dashed var(--text-muted)'}}/>
    </div>
  );
}

window.ForecastView = ForecastView;
