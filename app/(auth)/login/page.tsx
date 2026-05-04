'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img src="/logo.png" alt="FG Medios" style={{ height: 36, objectFit: 'contain' }} />
      </div>

      <div className="card" style={{ padding: 28 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>
          Iniciar sesión
        </h1>
        <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: 13 }}>
          Ingresá a tu workspace de CRM FG Medios
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
            <label>Email</label>
            <input
              className="input"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn primary"
            style={{ height: 36, marginTop: 4, justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12.5, color: 'var(--text-muted)' }}>
        ¿No tenés cuenta?{' '}
        <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 500 }}>
          Registrarse
        </Link>
      </p>
    </div>
  )
}
