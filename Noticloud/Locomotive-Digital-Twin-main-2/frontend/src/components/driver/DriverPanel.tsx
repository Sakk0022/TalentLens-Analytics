// src/components/driver/DriverPanel.tsx
// Redesigned for 50/50 layout — all info visible without scrolling.

import { HealthRing } from '@/components/shared/HealthRing'
import { AlertList } from '@/components/shared/AlertList'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SparklineChart } from '@/components/shared/SparklineChart'
import type { LocomotiveState } from '@/types'

interface MetricProps {
  label: string
  value: string
  unit?: string
  warn?: boolean
  alert?: boolean
}

function Metric({ label, value, unit, warn, alert }: MetricProps) {
  const valueColor = alert
    ? 'text-red-700'
    : warn
      ? 'text-amber-700'
      : 'text-slate-900'
  return (
    <div className={`rounded-lg p-2.5 border flex flex-col gap-0.5 ${alert
      ? 'bg-red-50 border-red-200'
      : warn
        ? 'bg-amber-50 border-amber-200'
        : 'bg-surface border-surface-border'}`}>
      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-base font-semibold font-mono ${valueColor}`}>{value}</span>
        {unit && <span className="text-[10px] text-slate-500">{unit}</span>}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">{children}</div>
}

interface Props {
  loco: LocomotiveState
  locoId: string
}

export function DriverPanel({ loco, locoId }: Props) {
  const hi = loco.health_index
  const isElectric = loco.locomotive_type === 'KZ8A'
  const speedHistory = loco.history.map(h => h.speed_kmh)
  const tempHistory = loco.history.map(h => h.engine_temp_c)

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">

      {/* identity row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono font-semibold text-slate-900 text-sm">{locoId}</span>
        <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${isElectric
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
          {loco.locomotive_type}
        </span>
        <StatusBadge status={hi.status} />
        <span className="text-xs font-mono text-slate-500 ml-auto">
          {new Date(loco.timestamp).toLocaleTimeString('ru-RU')}
        </span>
      </div>

      {/* HI + factors */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-3">
        <SectionLabel>Health Index</SectionLabel>
        <div className="flex items-center gap-3">
          <HealthRing hi={hi} size={64} />
          <div className="flex-1">
            {hi.factors.length === 0
              ? <div className="text-xs text-green-400 font-mono">Нет отклонений</div>
              : hi.factors.map((f, idx) => (
                  <div key={`${f.name}-${idx}`} className="flex justify-between text-xs font-mono mb-0.5">
                  <span className="text-gray-600 truncate pr-2">{f.name}</span>
                  <span className="text-red-400 flex-shrink-0">−{f.penalty}</span>
                </div>
              ))
            }
            <div className="text-[10px] font-mono text-slate-500 mt-1.5 leading-relaxed">
              {hi.recommendation}
            </div>
          </div>
        </div>
      </div>

      {/* traction & movement */}
      <div>
        <SectionLabel>Тяга и движение</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Скорость" value={loco.speed_kmh.toFixed(0)} unit="км/ч" warn={loco.speed_kmh > 100} alert={loco.speed_kmh > 110} />
          <Metric label="Координаты" value={`${loco.lat.toFixed(3)}, ${loco.lon.toFixed(3)}`} />
        </div>
      </div>

      {/* resources */}
      <div>
        <SectionLabel>Ресурсы</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <Metric label={isElectric ? 'Заряд' : 'Топливо'} value={loco.resource_level.toFixed(1)} unit="%" warn={loco.resource_level < 30} alert={loco.resource_level < 15} />
          <Metric label="Давление" value={loco.pressure_bar.toFixed(2)} unit="бар" warn={loco.pressure_bar > 5.8} alert={loco.pressure_bar > 6.2} />
        </div>
      </div>

      {/* node monitoring */}
      <div>
        <SectionLabel>Мониторинг узлов</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Темп. двигателя" value={loco.engine_temp_c.toFixed(1)} unit="°C" warn={loco.engine_temp_c > 95} alert={loco.engine_temp_c > 105} />
          <Metric label="Темп. масла" value={loco.oil_temp_c.toFixed(1)} unit="°C" warn={loco.oil_temp_c > 90} />
        </div>
      </div>

      {/* trends */}
      {speedHistory.length > 3 && (
        <div>
          <SectionLabel>Тренды</SectionLabel>
          <div className="bg-surface-card border border-surface-border rounded-xl p-2.5 flex flex-col gap-2">
            <div>
              <div className="text-[10px] font-mono text-slate-500 mb-0.5">Скорость</div>
              <SparklineChart data={speedHistory} color="#3b82f6" label="Скорость" unit=" км/ч" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-slate-500 mb-0.5">Температура двигателя</div>
              <SparklineChart data={tempHistory} color="#f97316" label="Темп." unit="°C" />
            </div>
          </div>
        </div>
      )}

      {/* alerts */}
      <div>
        <SectionLabel>Оповещения</SectionLabel>
        <AlertList alerts={loco.alerts} />
      </div>

    </div>
  )
}
