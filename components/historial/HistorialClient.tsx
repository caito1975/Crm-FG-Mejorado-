'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import type { HistorialLead, HistorialTipo } from '@/lib/types'

const TIPOS: HistorialTipo[] = ['ASIGNACION', 'CAMBIO_ESTADO', 'NOTA', 'LLAMADA', 'EMAIL', 'WHATSAPP']

const TIPO_STYLE: Record<HistorialTipo, { bg: string; color: string }> = {
  ASIGNACION:    { bg: 'var(--warning-soft)',  color: 'oklch(48% 0.15 75)'  },
  CAMBIO_ESTADO: { bg: 'var(--info-soft)',     color: 'var(--info)'          },
  NOTA:          { bg: 'var(--bg-panel)',       color: 'var(--text-muted)'   },
  LLAMADA:       { bg: 'var(--success-soft)',  color: 'var(--success)'       },
  EMAIL:         { bg: 'var(--accent-soft)',   color: 'var(--accent)'        },
  WHATSAPP:      { bg: 'oklch(92% 0.08 145)', color: 'oklch(42% 0.18 145)' },
}

export default function HistorialClient({ registros }: { registros: HistorialLead[] }) {
  const [search, setSearch] = useState('')
  const [selectedTipos, setSelectedTipos] = useState<HistorialTipo[]>([])
  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return registros.filter(h => {
      const matchSearch = !q ||
        h.nombre.toLowerCase().includes(q) ||
        (h.numero ?? '').includes(q)
      const matchTipo = selectedTipos.length === 0 || selectedTipos.includes(h.tipo)
      return matchSearch && matchTipo
    })
  }, [registros, search, selectedTipos])

  const toggleTipo = (tipo: HistorialTipo) => {
    setSelectedTipos(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    )
  }

  const dropLabel = selectedTipos.length === 0
    ? 'Choose options'
    : selectedTipos.length === 1 ? selectedTipos[0] : `${selectedTipos.length} seleccionados`

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

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Buscar (nombre / número)
          </label>
          <input
            className="input"
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
                cursor: 'pointer', userSelect: 'none',
              }}
              onClick={() => setDropOpen(o => !o)}
            >
              <span style={{ color: selectedTipos.length === 0 ? 'var(--text-muted)' : 'var(--text)', fontSize: 13 }}>
                {dropLabel}
              </span>
              <Icon name="chev_down" size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
            {dropOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 99,
                background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: 4,
              }}>
                {TIPOS.map(tipo => {
                  const s = TIPO_STYLE[tipo]
                  return (
                    <div
                      key={tipo}
                      style={{
                        padding: '7px 10px', borderRadius: 5, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                        background: selectedTipos.includes(tipo) ? 'var(--accent-soft)' : 'transparent',
                      }}
                      onClick={() => toggleTipo(tipo)}
                    >
                      <span className={`chk ${selectedTipos.includes(tipo) ? 'on' : ''}`} />
                      <span style={{
                        background: s.bg, color: s.color,
                        padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                      }}>
                        {tipo}
                      </span>
                    </div>
                  )
                })}
                {selectedTipos.length > 0 && (
                  <div
                    style={{
                      padding: '6px 10px', fontSize: 11.5, color: 'var(--text-muted)',
                      cursor: 'pointer', borderTop: '1px solid var(--border)', marginTop: 4,
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
              <th style={{ width: 40, textAlign: 'center' }}></th>
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
            {filtered.map((h, i) => {
              const s = TIPO_STYLE[h.tipo]
              return (
                <tr key={h.id}>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11.5 }}>{i}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {h.fecha ? new Date(h.fecha).toLocaleString('es-AR', { hour12: false }) : '—'}
                  </td>
                  <td style={{ fontWeight: 450 }}>{h.nombre}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{h.numero ?? '—'}</td>
                  <td>
                    <span style={{
                      background: s.bg, color: s.color,
                      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}>
                      {h.tipo}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{h.mensaje ?? ''}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {h.etapa_anterior ?? '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {h.etapa_nueva ?? '—'}
                  </td>
                  <td style={{ fontSize: 13 }}>{h.vendedor ?? '—'}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{h.notas ?? ''}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <div className="empty">
                    <h4>Sin registros</h4>
                    <p>
                      {registros.length === 0
                        ? 'Ejecutá la migración migration_crm07.sql en Supabase para activar esta tabla.'
                        : 'No hay resultados para los filtros aplicados.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
