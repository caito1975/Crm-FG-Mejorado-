'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_STAGES } from '@/lib/types'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function seedDefaultStages(userId: string) {
    const stages = DEFAULT_STAGES.map(s => ({ ...s, user_id: userId }))
    await supabase.from('pipeline_stages').upsert(stages, { onConflict: 'id,user_id' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      await seedDefaultStages(data.user.id)
      if (data.session) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setSuccess(true)
        setLoading(false)
      }
    }
  }

  if (success) {
    return (
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✉️</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>Revisá tu email</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
            Te enviamos un enlace de confirmación a <b>{email}</b>. Confirmá tu cuenta para ingresar.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img src="/logo.png" alt="FG Medios" style={{ height: 36, objectFit: 'contain' }} />
      </div>

      <div className="card" style={{ padding: 28 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>
          Crear cuenta
        </h1>
        <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: 13 }}>
          Creá tu workspace gratuito de CRM FG Medios
        </p>

        {error && (
          <div style={{
            padding: '10px 12px', marginBottom: 16,
            background: 'var(--danger-soft)', color: 'var(--danger)',
            borderRadius: 'var(--r-sm)', fontSize: 12.5,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>Nombre</label>
            <input
              className="input"
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              className="input"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <button
            type="submit"
            className="btn primary"
            style={{ height: 36, marginTop: 4, justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>
      </div>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12.5, color: 'var(--text-muted)' }}>
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>
          Iniciar sesión
        </Link>
      </p>
    </div>
  )
}
