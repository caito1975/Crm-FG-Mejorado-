'use client'

interface SparklineProps {
  data: number[]
  color?: string
  height?: number
  width?: number
  fill?: boolean
}

export default function Sparkline({
  data,
  color = 'var(--accent)',
  height = 28,
  width = 120,
  fill = true,
}: SparklineProps) {
  if (!data.length) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return [x, y] as [number, number]
  })
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ')
  const fillPath = `${path} L${width},${height} L0,${height} Z`
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {fill && <path d={fillPath} fill={color} opacity={0.12} />}
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
