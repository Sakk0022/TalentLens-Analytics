// src/components/dispatcher/LocoDetail.tsx

import { Panel } from '@/components/shared/Panel'
import { HealthRing } from '@/components/shared/HealthRing'
import { MetricCard } from '@/components/shared/MetricCard'
import { AlertList } from '@/components/shared/AlertList'
import { SparklineChart } from '@/components/shared/SparklineChart'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { LocomotiveState } from '@/types'

export function LocoDetail({ loco }: { loco: LocomotiveState }) {
  const hi = loco.health_index
  const isElectric = loco.locomotive_type === 'KZ8A'

  return (
    <div className="flex flex-col gap-3">

      <div className="flex items-center gap-2 px-0.5">
        <span className="text-sm font-mono font-semibold text-slate-900">{loco.locomotive_id}</span>
        <span className="text-xs font-mono text-gray-600">{loco.locomotive_type}</span>
        <StatusBadge status={hi.status} />
        {loco.route && (
          <span className="text-xs font-mono text-slate-500 ml-2">{loco.route}</span>
        )}
        <span className="text-xs font-mono text-slate-500 ml-auto">
          {new Date(loco.timestamp).toLocaleTimeString('ru-RU')}
        </span>
      </div>

      <Panel title="Health Index">
        <div className="flex items-center gap-4">
          <HealthRing hi={hi} size={64} />
          <div className="flex-1">
            {hi.factors.length === 0
              ? <div className="text-xs text-green-400 font-mono">Нет отклонений</div>
              : hi.factors.map((f, idx) => (
                <div key={`${f.name ?? 'factor'}-${idx}`} className="flex justify-between text-xs font-mono mb-0.5">
                  <span className="text-gray-600 truncate pr-1">{f.name}</span>
                  <span className="text-red-400 flex-shrink-0">−{f.penalty}</span>
                </div>
              ))
            }
          </div>
        </div>
        <p className="text-xs font-mono text-gray-600 border-t border-surface-border pt-2 mt-2">
          {hi.recommendation}
        </p>
      </Panel>

      <Panel title="Параметры">
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Скорость" value={loco.speed_kmh.toFixed(0)} unit="км/ч" warn={loco.speed_kmh > 100} alert={loco.speed_kmh > 110} />
          <MetricCard label={isElectric ? 'Заряд' : 'Топливо'} value={loco.resource_level.toFixed(1)} unit="%" warn={loco.resource_level < 30} alert={loco.resource_level < 15} />
          <MetricCard label="Темп. двиг." value={loco.engine_temp_c.toFixed(1)} unit="°C" warn={loco.engine_temp_c > 95} alert={loco.engine_temp_c > 105} />
          <MetricCard label="Давление" value={loco.pressure_bar.toFixed(2)} unit="бар" warn={loco.pressure_bar > 5.8} alert={loco.pressure_bar > 6.2} />
          <MetricCard label="Темп. масла" value={loco.oil_temp_c.toFixed(1)} unit="°C" warn={loco.oil_temp_c > 90} />
          <MetricCard label="Коорд." value={`${loco.lat.toFixed(3)}, ${loco.lon.toFixed(3)}`} />
        </div>
      </Panel>

      {loco.history.length > 3 && (
        <Panel title="Тренды">
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-xs font-mono text-slate-500 mb-0.5">Скорость (км/ч)</div>
              <SparklineChart data={loco.history.map(h => h.speed_kmh)} color="#3b82f6" label="Скорость" unit=" км/ч" />
            </div>
            <div>
              <div className="text-xs font-mono text-slate-500 mb-0.5">Температура (°C)</div>
              <SparklineChart data={loco.history.map(h => h.engine_temp_c)} color="#f97316" label="Темп." unit="°C" />
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Оповещения">
        <AlertList alerts={loco.alerts} />
      </Panel>
    </div>
  )
}
