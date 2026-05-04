import { getInitials } from '@/lib/types'

type Tone = 'accent' | 'info' | 'success' | 'warning' | 'danger'

const TONE_STYLES: Record<Tone, React.CSSProperties> = {
  accent:  { background: 'var(--accent-soft)',  color: 'var(--accent)' },
  info:    { background: 'var(--info-soft)',    color: 'var(--info)' },
  success: { background: 'var(--success-soft)', color: 'var(--success)' },
  warning: { background: 'var(--warning-soft)', color: 'oklch(48% 0.15 75)' },
  danger:  { background: 'var(--danger-soft)',  color: 'var(--danger)' },
}

interface AvatarProps {
  name: string
  initials?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  tone?: Tone
}

export default function Avatar({ name, initials, size = 'md', tone }: AvatarProps) {
  const ini = initials || getInitials(name)
  const cls = size === 'lg' ? 'avatar lg' : size === 'xl' ? 'avatar xl' : 'avatar'
  return (
    <span className={cls} style={tone ? TONE_STYLES[tone] : undefined} title={name}>
      {ini}
    </span>
  )
}
