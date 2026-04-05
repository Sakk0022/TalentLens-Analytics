// src/pages/RoleSelect.tsx

import type { UserRole } from '@/types'

interface Props {
  onSelect: (role: UserRole) => void
}

export function RoleSelect({ onSelect }: Props) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 gap-8">

      <div className="text-center">
        <div className="text-[10px] font-mono text-gray-700 uppercase tracking-widest mb-3">
          KZ8A · ТЭ33А · Телеметрия · Мониторинг
        </div>
        <h1 className="text-2xl font-semibold font-mono text-slate-900 mb-1">
          Цифровой двойник локомотива
        </h1>
        <p className="text-sm font-mono text-slate-500">
          Визуальный мониторинг · Health Index · Реальное время
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">

        <button
          onClick={() => onSelect('driver')}
          className="group text-left bg-surface-card border border-surface-border rounded-2xl p-6
                     hover:border-gray-300 hover:bg-surface-hover transition-all active:scale-[0.98]"
        >
          <div className="text-3xl mb-4">🚂</div>
          <div className="font-mono font-semibold text-slate-900 text-base mb-0.5">Машинист</div>
          <div className="font-mono text-xs text-slate-500 mb-3">Driver view</div>
          <p className="text-xs font-mono text-gray-600 leading-relaxed">
            Выбор локомотива → маршрут на карте Казахстана → параметры и Health Index в реальном времени
          </p>
          <div className="mt-4 text-xs font-mono text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
            Выбрать локомотив →
          </div>
        </button>

        <button
          onClick={() => onSelect('dispatcher')}
          className="group text-left bg-surface-card border border-surface-border rounded-2xl p-6
                     hover:border-gray-300 hover:bg-surface-hover transition-all active:scale-[0.98]"
        >
          <div className="text-3xl mb-4">📡</div>
          <div className="font-mono font-semibold text-slate-900 text-base mb-0.5">Диспетчер</div>
          <div className="font-mono text-xs text-slate-500 mb-3">Dispatcher view</div>
          <p className="text-xs font-mono text-gray-600 leading-relaxed">
            Весь парк на интерактивной карте → клик на любой локомотив → детальные данные
          </p>
          <div className="mt-4 text-xs font-mono text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
            Открыть пульт →
          </div>
        </button>

      </div>

      <div className="text-[10px] font-mono text-gray-700">demo-MVP · хакатон 04–05.04.2026</div>
    </div>
  )
}
