// src/components/dispatcher/LocoList.tsx

import { clsx } from 'clsx'
import { HealthRing } from '@/components/shared/HealthRing'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { LocomotiveState } from '@/types'

interface Props {
  locos: LocomotiveState[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function LocoList({ locos, selectedId, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {locos.map((loco, idx) => {
        const selected = loco.locomotive_id === selectedId
        return (
          <button
            key={`${loco.locomotive_id}-${idx}`}
            onClick={() => onSelect(loco.locomotive_id)}
            className={clsx(
              'w-full text-left rounded-lg border px-3 py-2.5 transition-all font-mono',
              selected
                ? 'bg-blue-950/50 border-blue-700'
                : 'bg-surface-card border-surface-border hover:bg-surface-hover hover:border-gray-600'
            )}
          >
            <div className="flex items-center gap-2.5">
              <HealthRing hi={loco.health_index} size={38} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {loco.locomotive_id}
                  </span>
                  <StatusBadge status={loco.health_index.status} />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>{loco.locomotive_type}</span>
                  <span>·</span>
                  <span>{(loco.speed_kmh ?? 0).toFixed(0)} км/ч</span>
                  {loco.alerts.length > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-red-400">{loco.alerts.length} ошиб.</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
