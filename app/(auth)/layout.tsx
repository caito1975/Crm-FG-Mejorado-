export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'var(--bg)',
      padding: '24px',
    }}>
      {children}
    </div>
  )
}
