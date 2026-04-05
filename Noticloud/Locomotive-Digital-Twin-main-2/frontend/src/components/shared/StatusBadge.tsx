import { clsx } from 'clsx'
import type { HealthStatus } from '@/types'

const cfg: Record<HealthStatus, { label: string; cls: string }> = {
  normal: {
    label: 'Норма',
    cls: 'bg-green-50 text-green-700 border-green-200',
  },
  warning: {
    label: 'Внимание',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  critical: {
    label: 'Критично',
    cls: 'bg-red-50 text-red-700 border-red-200',
  },
}

export function StatusBadge({ status }: { status?: HealthStatus | null }) {
  const entry = cfg[status ?? 'normal'] ?? cfg.normal
  const { label, cls } = entry
  return (
    <span className={clsx('text-xs px-2 py-0.5 rounded border font-mono', cls)}>
      {label}
    </span>
  )
}