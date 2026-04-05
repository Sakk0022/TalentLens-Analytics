// src/components/dispatcher/DispatcherDashboard.tsx

import { useState } from 'react'
import { useTelemetry } from '@/hooks/useTelemetry'
import { LocoMap } from '@/components/shared/LocoMap'
import { ConfigManager } from '@/components/shared/ConfigManager'
import { HistoryViewer } from '@/components/shared/HistoryViewer'
import { AlertsViewer } from '@/components/shared/AlertsViewer'
import { FleetSummary } from './FleetSummary'
import { LocoList } from './LocoList'
import { LocoDetail } from './LocoDetail'
import { clsx } from 'clsx'

interface Props {
  onBack: () => void
}

type TabType = 'fleet' | 'alerts' | 'history' | 'config'

export function DispatcherDashboard({ onBack }: Props) {
  const { locos, getLoco, summary } = useTelemetry()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('fleet')

  const selectedLoco = selectedId ? getLoco(selectedId) : null

  const handleSelect = (id: string) => {
    setSelectedId(prev => prev === id ? null : id)
  }

  return (
    <div className="flex flex-col h-full bg-surface text-slate-900">

      {/* header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-border flex-shrink-0 bg-white/90 backdrop-blur-sm">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="font-mono text-sm font-medium text-slate-900">Диспетчерский пульт</span>

        {(summary.critical + summary.warning) > 0 && (
          <span className="text-xs font-mono bg-red-900/60 text-red-300 border border-red-800 px-2 py-0.5 rounded animate-pulse">
            {summary.critical + summary.warning} требуют внимания
          </span>
        )}

        <div className="flex items-center gap-3 ml-auto text-xs font-mono text-slate-500">
          {locos.length > 0 && new Date(locos[0].timestamp).toLocaleTimeString('ru-RU')}
        </div>

        <button
          onClick={onBack}
          className="text-xs font-mono text-slate-600 border border-surface-border px-3 py-1 rounded-lg hover:bg-surface-hover transition-colors"
        >
          ← Назад
        </button>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-surface-border flex-shrink-0 bg-slate-50 overflow-x-auto">
        {[
          { id: 'fleet' as const, label: '🗺️ Парк' },
          { id: 'alerts' as const, label: '🚨 Алерты' },
          { id: 'history' as const, label: '📊 История' },
          { id: 'config' as const, label: '⚙️ Конфиг' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-3 py-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-blue-600 text-white border border-blue-700'
                : 'text-slate-700 hover:bg-slate-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'fleet' && (
          <div className="flex h-full">
            {/* LEFT: Map — 58% */}
            <div className="flex-[58] min-w-0 p-3 pr-1.5">
              {locos.length > 0 ? (
                <LocoMap
                  locos={locos}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                />
              ) : (
                <div className="w-full h-full bg-surface-card border border-surface-border rounded-xl flex items-center justify-center text-slate-500 font-mono text-sm">
                  Ожидание телеметрии…
                </div>
              )}
            </div>

            {/* RIGHT: sidebar — 42% */}
            <div className="flex-[42] min-w-0 flex flex-col gap-3 p-3 pl-1.5 overflow-y-auto min-h-0">

              {/* fleet summary always visible */}
              <FleetSummary summary={summary} />

              {/* loco list */}
              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">
                  Парк локомотивов
                </div>
                <LocoList locos={locos} selectedId={selectedId} onSelect={handleSelect} />
              </div>

              {/* selected detail */}
              {selectedLoco && (
                <div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">
                    Данные · {selectedId}
                  </div>
                  <LocoDetail loco={selectedLoco} />
                </div>
              )}

              {!selectedId && locos.length > 0 && (
                <div className="text-xs font-mono text-gray-700 text-center py-4">
                  Нажмите на локомотив в списке или на карте
                </div>
              )}

            </div>
          </div>
        )}

        {activeTab === 'alerts' && <AlertsViewer />}
        {activeTab === 'history' && <HistoryViewer />}
        {activeTab === 'config' && <ConfigManager />}
      </div>
    </div>
  )
}
