// src/components/driver/DriverDashboard.tsx

import { useState } from 'react'
import { useTelemetry } from '@/hooks/useTelemetry'
import { LocoMap } from '@/components/shared/LocoMap'
import { DriverPanel } from './DriverPanel'
import { LocoSelector } from './LocoSelector'

interface Props {
  onBack: () => void
}

export function DriverDashboard({ onBack }: Props) {
  const [selectedLocoId, setSelectedLocoId] = useState<string | null>(null)
  const { locos } = useTelemetry()

  // Step 1: pick locomotive
  if (!selectedLocoId) {
    return <LocoSelector onSelect={setSelectedLocoId} onBack={onBack} />
  }

  const myLoco = locos.find(l => l.locomotive_id === selectedLocoId)

  return (
    <div className="flex flex-col h-full bg-surface text-slate-900">

      {/* header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-border flex-shrink-0 bg-surface-card">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="font-mono text-sm font-medium text-slate-900">
          {selectedLocoId} · Машинист
        </span>
        <span className="text-xs font-mono text-slate-500">
          {myLoco?.locomotive_type}
        </span>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => setSelectedLocoId(null)}
            className="text-xs font-mono text-gray-600 border border-surface-border px-3 py-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            Сменить
          </button>
          <button
            onClick={onBack}
            className="text-xs font-mono text-gray-600 border border-surface-border px-3 py-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            ← Назад
          </button>
        </div>
      </header>

      {/* 50/50 body */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* LEFT: Map — 55% */}
        <div className="flex-[55] min-w-0 p-3 pr-1.5">
          {locos.length > 0 ? (
            <LocoMap locos={locos} singleId={selectedLocoId} />
          ) : (
            <div className="w-full h-full bg-surface-card border border-surface-border rounded-xl flex items-center justify-center text-slate-500 font-mono text-sm">
              Ожидание телеметрии…
            </div>
          )}
        </div>

        {/* RIGHT: Panel — 45% */}
        <div className="flex-[45] min-w-0 p-3 pl-1.5 overflow-y-auto">
          {myLoco ? (
            <DriverPanel loco={myLoco} locoId={selectedLocoId} />
          ) : (
            <div className="text-xs font-mono text-slate-500 p-2 text-center mt-8">
              Ожидание данных по {selectedLocoId}…
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
