'use client'
import { useState } from 'react'
import type { Task } from '@/lib/types'
import Icon from '@/components/ui/Icon'
import { PriorityPill } from '@/components/ui/Pill'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function getWeekDates(base: Date) {
  const day = base.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(base)
  mon.setDate(base.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

export default function CalendarClient({ tasks }: { tasks: Task[] }) {
  const [baseDate, setBaseDate] = useState(new Date())
  const weekDates = getWeekDates(baseDate)

  const prevWeek = () => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d) }
  const nextWeek = () => { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d) }
  const today    = () => setBaseDate(new Date())

  const tasksForDate = (date: Date) =>
    tasks.filter(t => {
      if (!t.due_date) return false
      const td = new Date(t.due_date)
      return td.toDateString() === date.toDateString()
    })

  const now = new Date()

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Calendario</h1>
          <p>Semana del {weekDates[0].toLocaleDateString('es', { day: 'numeric', month: 'long' })} al {weekDates[6].toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="page-actions">
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button className="btn ghost icon" onClick={prevWeek}><Icon name="chev_left" size={14} /></button>
            <button className="btn" onClick={today}>Hoy</button>
            <button className="btn ghost icon" onClick={nextWeek}><Icon name="chev_right" size={14} /></button>
          </div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ borderRight: '1px solid var(--border)' }} />
          {weekDates.map((d, i) => {
            const isToday = d.toDateString() === now.toDateString()
            return (
              <div key={i} style={{ padding: '10px 8px', textAlign: 'center', borderRight: i < 6 ? '1px solid var(--border)' : 'none', background: isToday ? 'var(--accent-soft)' : undefined }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{DAYS[i]}</div>
                <div style={{ fontSize: 15, fontWeight: isToday ? 600 : 400, width: 28, height: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: isToday ? 'var(--accent)' : 'transparent', color: isToday ? 'white' : 'var(--text)' }}>
                  {d.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* All-day tasks row */}
        <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', minHeight: 60, borderBottom: '1px solid var(--border)' }}>
          <div style={{ borderRight: '1px solid var(--border)', padding: '4px 6px', fontSize: 10, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            TODO DÍA
          </div>
          {weekDates.map((d, i) => {
            const dayTasks = tasksForDate(d)
            return (
              <div key={i} style={{ borderRight: i < 6 ? '1px solid var(--border)' : 'none', padding: '4px 6px', minHeight: 60 }}>
                {dayTasks.map(t => (
                  <div key={t.id} style={{
                    padding: '3px 6px', borderRadius: 'var(--r-xs)',
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    fontSize: 11.5, fontWeight: 500, marginBottom: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Pending tasks below */}
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-subtle)', marginBottom: 12 }}>
            Tareas pendientes sin fecha
          </div>
          {tasks.filter(t => !t.done && !t.due_date).slice(0, 8).map(t => (
            <div key={t.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <span className={`chk ${t.done ? 'on' : ''}`} />
              <span style={{ flex: 1, fontSize: 13 }}>{t.title}</span>
              <PriorityPill priority={t.priority} />
              {t.due_label && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t.due_label}</span>}
            </div>
          ))}
          {tasks.filter(t => !t.done && !t.due_date).length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Todas las tareas tienen fecha asignada. 🎉</p>
          )}
        </div>
      </div>
    </div>
  )
}
