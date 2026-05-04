// Norte CRM — Historial de Leads

function LeadHistory() {
  const N = window.NORTE;
  const [search, setSearch] = useState('');
  const [selectedTipos, setSelectedTipos] = useState([]);
  const [tiposOpen, setTiposOpen] = useState(false);
  const dropRef = useRef(null);

  const TIPOS = ['ASIGNACION', 'CAMBIO_ESTADO', 'NOTA', 'LLAMADA', 'EMAIL'];

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setTiposOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return N.historial.filter(h => {
      const matchSearch = !q ||
        h.nombre.toLowerCase().includes(q) ||
        h.numero.includes(q);
      const matchTipo = selectedTipos.length === 0 || selectedTipos.includes(h.tipo);
      return matchSearch && matchTipo;
    });
  }, [N.historial, search, selectedTipos]);

  const toggleTipo = (tipo) => {
    setSelectedTipos(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  };

  const TIPO_CLS = {
    ASIGNACION:    'warning',
    CAMBIO_ESTADO: 'info',
    NOTA:          '',
    LLAMADA:       'success',
    EMAIL:         'accent',
  };

  const tiposLabel = selectedTipos.length === 0
    ? 'Choose options'
    : selectedTipos.length === 1
      ? selectedTipos[0]
      : `${selectedTipos.length} seleccionados`;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="clock" size={20} />
            Historial de Leads
          </h1>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Buscar (nombre / número)
          </label>
          <input
            className="input"
            placeholder=""
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ width: 260 }} ref={dropRef}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Tipo
          </label>
          <div style={{ position: 'relative' }}>
            <div
              className="input"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', userSelect: 'none'
              }}
              onClick={() => setTiposOpen(o => !o)}
            >
              <span style={{ color: selectedTipos.length === 0 ? 'var(--text-muted)' : 'var(--text)', fontSize: 13 }}>
                {tiposLabel}
              </span>
              <Icon name="chev_down" size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
            {tiposOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 99,
                background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: 4
              }}>
                {TIPOS.map(tipo => (
                  <div
                    key={tipo}
                    style={{
                      padding: '7px 10px', borderRadius: 5, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                      background: selectedTipos.includes(tipo) ? 'var(--accent-soft)' : 'transparent'
                    }}
                    onClick={() => toggleTipo(tipo)}
                  >
                    <span className={`chk ${selectedTipos.includes(tipo) ? 'on' : ''}`} />
                    <span className={`pill ${TIPO_CLS[tipo] || ''}`} style={{ pointerEvents: 'none' }}>{tipo}</span>
                  </div>
                ))}
                {selectedTipos.length > 0 && (
                  <div
                    style={{
                      padding: '6px 10px', fontSize: 11.5, color: 'var(--text-muted)',
                      cursor: 'pointer', borderTop: '1px solid var(--border)', marginTop: 4
                    }}
                    onClick={() => setSelectedTipos([])}
                  >
                    Limpiar selección
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>
        {filtered.length} registros
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: 'center', color: 'var(--text-subtle)', fontWeight: 400 }}></th>
              <th>fecha</th>
              <th>nombre</th>
              <th>numero</th>
              <th>tipo</th>
              <th>mensaje</th>
              <th>etapa_anterior</th>
              <th>etapa_nueva</th>
              <th>vendedor</th>
              <th>notas</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h, i) => (
              <tr key={h.id}>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11.5 }}>{i}</td>
                <td className="cell-mono" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{h.fecha}</td>
                <td style={{ fontWeight: 450 }}>{h.nombre}</td>
                <td className="cell-mono" style={{ fontSize: 12 }}>{h.numero}</td>
                <td>
                  <span className={`pill ${TIPO_CLS[h.tipo] || ''}`}>{h.tipo}</span>
                </td>
                <td style={{ fontSize: 13 }}>{h.mensaje}</td>
                <td className="cell-mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{h.etapa_anterior}</td>
                <td className="cell-mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{h.etapa_nueva}</td>
                <td style={{ fontSize: 13 }}>{h.vendedor}</td>
                <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{h.notas || ''}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
