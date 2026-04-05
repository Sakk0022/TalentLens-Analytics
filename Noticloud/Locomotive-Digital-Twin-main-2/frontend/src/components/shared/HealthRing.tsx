// src/components/shared/HealthRing.tsx

import type { HealthIndex } from '@/types'

const colors: Record<string, { stroke: string; text: string; bg: string }> = {
  normal: { stroke: '#16a34a', text: '#15803d', bg: '#f0fdf4' },
  warning: { stroke: '#d97706', text: '#b45309', bg: '#fffbeb' },
  critical: { stroke: '#dc2626', text: '#b91c1c', bg: '#fef2f2' },
}

interface Props {
  hi?: HealthIndex | null
  size?: number
}

export function HealthRing({ hi, size = 80 }: Props) {
  const safeHi = hi ?? { score: 0, status: 'normal' as const, factors: [], recommendation: '' }
  const c = colors[safeHi.status] ?? colors.normal
  const r = (size / 2) - 6
  const circ = 2 * Math.PI * r
  const dash = (safeHi.score / 100) * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill={c.bg} stroke="#dbeafe" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={c.stroke}
          strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
        <text
          x="50%" y="50%"
          textAnchor="middle" dominantBaseline="central"
          fill={c.text}
          fontSize={size * 0.22}
          fontWeight={600}
          fontFamily="JetBrains Mono, monospace"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
        >
          {Math.round(safeHi.score)}
        </text>
      </svg>
    </div>
  )
}
