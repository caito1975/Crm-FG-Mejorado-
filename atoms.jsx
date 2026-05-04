// Norte CRM — shared UI atoms

const Avatar = ({ name, initials, size, tone, src }) => {
  const sz = size === 'lg' ? 'lg' : size === 'xl' ? 'xl' : '';
  const ini = initials || (name ? name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase() : '?');
  const toneStyle = tone ? {
    accent:  { background: 'var(--accent-soft)',  color: 'var(--accent)' },
    info:    { background: 'var(--info-soft)',    color: 'var(--info)' },
    success: { background: 'var(--success-soft)', color: 'var(--success)' },
    warning: { background: 'var(--warning-soft)', color: 'oklch(48% 0.15 75)' },
    danger:  { background: 'var(--danger-soft)',  color: 'var(--danger)' },
  }[tone] : null;
  return <span className={`avatar ${sz}`} style={toneStyle}>{ini}</span>;
};

const StatusPill = ({ status }) => {
  const map = {
    cliente:     { cls: 'success', label: 'Cliente' },
    oportunidad: { cls: 'accent',  label: 'Oportunidad' },
    lead:        { cls: 'info',    label: 'Lead' },
    archivado:   { cls: '',        label: 'Archivado' },
  };
  const m = map[status] || { cls: '', label: status };
  return <span className={`pill ${m.cls}`}><span className="dot" />{m.label}</span>;
};

const PriorityPill = ({ p }) => {
  const map = { alta: 'danger', media: 'warning', baja: '' };
  return <span className={`pill ${map[p]||''}`}>{p}</span>;
};

const Sparkline = ({ data, color = 'var(--accent)', height = 28, width = 120, fill = true }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const fillPath = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} className="spark-line" style={{display:'block'}}>
      {fill && <path d={fillPath} fill={color} opacity="0.12" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
};

const Bar = ({ value }) => <div className="bar"><span style={{width: `${value}%`}}/></div>;

const SearchInput = ({ placeholder = 'Buscar', value, onChange }) => (
  <div className="sidebar-search" style={{padding: 0, position: 'relative'}}>
    <span className="ico"><Icon name="search" size={13}/></span>
    <input value={value||''} onChange={e=>onChange&&onChange(e.target.value)} placeholder={placeholder}/>
  </div>
);

Object.assign(window, { Avatar, StatusPill, PriorityPill, Sparkline, Bar, SearchInput });
