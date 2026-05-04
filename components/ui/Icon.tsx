// Linear-style icons — 1.6px stroke, round joins
const ICONS: Record<string, string> = {
  dashboard:  '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  contacts:   '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5"/>',
  pipeline:   '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
  tasks:      '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9.5l2 2 4-4"/><path d="M14 16h4"/>',
  calendar:   '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/>',
  reports:    '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  inbox:      '<path d="M22 13l-3.5-7A2 2 0 0 0 16.7 5H7.3a2 2 0 0 0-1.8 1L2 13"/><path d="M2 13h6l1.5 3h5L16 13h6v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  settings:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search:     '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus:       '<path d="M12 5v14M5 12h14"/>',
  filter:     '<path d="M3 5h18M6 12h12M10 19h4"/>',
  more:       '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  chev_down:  '<path d="m6 9 6 6 6-6"/>',
  chev_right: '<path d="m9 6 6 6-6 6"/>',
  chev_left:  '<path d="m15 6-6 6 6 6"/>',
  arrow_up:   '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrow_dn:   '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  trend_up:   '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  trend_dn:   '<path d="M3 7l6 6 4-4 8 8"/><path d="M14 17h7v-7"/>',
  bell:       '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/>',
  star:       '<path d="m12 3 2.6 5.7 6.4.7-4.7 4.4 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.4l6.4-.7z"/>',
  star_fill:  '<path d="m12 3 2.6 5.7 6.4.7-4.7 4.4 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.4l6.4-.7z" fill="currentColor"/>',
  mail:       '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/>',
  phone:      '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/>',
  building:   '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8h.01M9 12h.01M9 16h.01M15 8h.01M15 12h.01M15 16h.01"/>',
  clock:      '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  doc:        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
  link:       '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  edit:       '<path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  dollar:     '<path d="M12 2v20M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H7"/>',
  flag:       '<path d="M4 21V4M4 4h12l-2 4 2 4H4"/>',
  archive:    '<rect x="3" y="3" width="18" height="5" rx="1.5"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4"/>',
  sparkles:   '<path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  send:       '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  reply:      '<path d="M9 17 4 12l5-5"/><path d="M4 12h11a5 5 0 0 1 0 10h-2"/>',
  globe:      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  meet:       '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3z"/>',
  card:       '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  team:       '<circle cx="9" cy="8" r="3"/><path d="M3 19c.8-3 3.4-4.5 6-4.5s5.2 1.5 6 4.5"/><circle cx="17" cy="9" r="2.5"/><path d="M22 18c-.5-2-2-3-4-3"/>',
  check:      '<path d="M5 12l5 5L20 7"/>',
  x:          '<path d="M6 6l12 12M18 6 6 18"/>',
  zap:        '<path d="m13 2-9 11h7l-1 9 9-11h-7z"/>',
  pin:        '<path d="M12 21v-7M5 10c0-3.9 3.1-7 7-7s7 3.1 7 7-7 11-7 11-7-7.1-7-11z"/><circle cx="12" cy="10" r="2.5"/>',
  drag:       '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
  trash:      '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  user_plus:  '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11v6M19 14h6"/>',
  invoice:    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h6M9 11h2"/>',
  company:    '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
}

interface IconProps {
  name: string
  size?: number
  className?: string
  style?: React.CSSProperties
}

export default function Icon({ name, size = 16, className, style }: IconProps) {
  const paths = ICONS[name]
  if (!paths) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  )
}
