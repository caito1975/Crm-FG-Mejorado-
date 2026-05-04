'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, TaskPriority, Contact } from '@/lib/types'
import Icon from '@/components/ui/Icon'
import { PriorityPill } from '@/components/ui/Pill'

type GroupBy = 'due' | 'priority'

interface Props {
  userId: string
  initialTasks: Task[]
  contacts: Pick<Contact, 'id' | 'name' | 'company'>[]
}

export default function TasksClient({ userId, initialTasks, contacts }: Props) {
  const supabase = createClient()
  const [tasks, setTasks]   = useState(initialTasks)
  const [groupBy, setGroupBy] = useState<GroupBy>('due')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', priority: 'media' as TaskPriority, due_label: '', contact_id: '' })

  const groups = useMemo(() => {
    if (groupBy === 'priority') return [
      { label: 'Alta',        items: tasks.filter(t => t.priority === 'alta'  && !t.done) },
      { label: 'Media',       items: tasks.filter(t => t.priority === 'media' && !t.done) },
      { label: 'Baja',        items: tasks.filter(t => t.priority === 'baja'  && !t.done) },
      { label: 'Completadas', items: tasks.filter(t => t.done) },
    ]
    return [
      { label: 'Hoy',         items: tasks.filter(t => !t.done && t.due_label?.startsWith('hoy')) },
      { label: 'Mañana',      items: tasks.filter(t => !t.done && t.due_label?.startsWith('mañana')) },
      { label: 'Esta semana', items: tasks.filter(t => !t.done && !t.due_label?.startsWith('hoy') && !t.due_label?.startsWith('mañana')) },
      { label: 'Completadas', items: tasks.filter(t => t.done) },
    ]
  }, [tasks, groupBy])

  async function toggleTask(id: string) {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const done = !task.done
    await supabase.from('tasks').update({ done }).eq('id', id)
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done } : t))
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(ts => ts.filter(t => t.id !== id))
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    const { data } = await supabase.from('tasks').insert({
      user_id: userId,
      title: form.title,
      priority: form.priority,
      due_label: form.due_label || null,
      contact_id: form.contact_id || null,
    }).select('*, contact:contacts(id,name,company)').single()
    if (data) setTasks(ts => [data as Task, ...ts])
    setForm({ title: '', priority: 'media', due_label: '', contact_id: '' })
    setShowForm(false)
  }

  const open = tasks.filter(t => !t.done).length
  const done = tasks.filter(t => t.done).length

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="page-head">
        <div>
          <h1>Tareas</h1>
          <p>{open} pendientes · {done} completadas</p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className={groupBy === 'due' ? 'on' : ''} onClick={() => setGroupBy('due')}>Por fecha</button>
            <button className={groupBy === 'priority' ? 'on' : ''} onClick={() => setGroupBy('priority')}>Por prioridad</button>
          </div>
          <button className="btn primary" onClick={() => setShowForm(true)}>
            <Icon name="plus" size={13} /> Nueva tarea
          </button>
        </div>
      </div>

      {/* New task form */}
      {showForm && (
        <form onSubmit={createTask} className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="input" placeholder="Descripción de la tarea *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required style={{ flex: 1 }} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
            <input className="input" placeholder="Vence (ej: hoy, mañana, 6 may)" value={form.due_label} onChange={e => setForm(f => ({ ...f, due_label: e.target.value }))} />
            <select className="input" value={form.contact_id} onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))}>
              <option value="">Sin contacto</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="submit" className="btn primary">Crear</button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {groups.map(g => g.items.length > 0 && (
        <div key={g.label} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-subtle)', padding: '0 0 8px' }}>
            {g.label} <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)', marginLeft: 6 }}>{g.items.length}</span>
          </div>
          <div className="card">
            {g.items.map((task, i) => {
              const contact = task.contact as any
              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 16px',
                    borderBottom: i < g.items.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <span className={`chk ${task.done ? 'on' : ''}`} onClick={() => toggleTask(task.id)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? 'var(--text-muted)' : 'var(--text)' }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                      {task.due_label && <><Icon name="clock" size={11} /> {task.due_label}</>}
                      {contact && <><span>·</span> {contact.company || contact.name}</>}
                    </div>
                  </div>
                  <PriorityPill priority={task.priority} />
                  <button className="btn ghost sm icon" onClick={() => deleteTask(task.id)} style={{ color: 'var(--text-subtle)' }}>
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
