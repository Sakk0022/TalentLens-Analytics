// src/components/driver/LocoSelector.tsx
// Screen shown to driver before the dashboard — pick your locomotive by type and number.

import { useState } from 'react'
import { LOCO_META } from '@/mock/simulator'
import type { LocoType } from '@/types'
import { clsx } from 'clsx'

interface Props {
  onSelect: (locoId: string) => void
  onBack: () => void
}

const TYPE_INFO: Record<LocoType, { name: string; desc: string; icon: string; specs: string[] }> = {
  TE33A: {
    name: 'ТЭ33А',
    desc: 'Тепловоз — дизельная тяга',
    icon: '🛤️',
    specs: ['Мощность: 3 310 кВт', 'Скорость: до 120 км/ч', 'Ресурс: топливо'],
  },
  KZ8A: {
    name: 'KZ8A',
    desc: 'Электровоз — переменный ток 25 кВ',
    icon: '⚡',
    specs: ['Мощность: 8 000 кВт', 'Скорость: до 200 км/ч', 'Ресурс: электроэнергия'],
  },
}

export function LocoSelector({ onSelect, onBack }: Props) {
  const [filterType, setFilterType] = useState<LocoType | 'all'>('all')

  const locos = Object.entries(LOCO_META)
  const filtered = filterType === 'all' ? locos : locos.filter(([, m]) => m.type === filterType)

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 gap-8">

      {/* header */}
      <div className="text-center">
        <button
          onClick={onBack}
          className="text-xs font-mono text-slate-500 hover:text-gray-600 mb-4 block mx-auto transition-colors"
        >
          ← Назад к выбору роли
        </button>
        <div className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Режим машиниста</div>
        <h1 className="text-xl font-semibold font-mono text-slate-900">Выберите ваш локомотив</h1>
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-6">

        {/* type info cards */}
        <div className="grid grid-cols-2 gap-3">
          {(Object.entries(TYPE_INFO) as [LocoType, typeof TYPE_INFO[LocoType]][]).map(([type, info]) => (
            <div key={type} className="bg-surface-card border border-surface-border rounded-xl p-4">
              <div className="text-xl mb-2">{info.icon}</div>
              <div className="font-mono font-semibold text-slate-900 text-sm">{info.name}</div>
              <div className="font-mono text-xs text-gray-600 mb-2">{info.desc}</div>
              <div className="flex flex-col gap-0.5">
                {info.specs.map(s => (
                  <div key={s} className="text-xs font-mono text-slate-500">{s}</div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* filter tabs */}
        <div className="flex gap-2">
          {(['all', 'TE33A', 'KZ8A'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={clsx(
                'text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors',
                filterType === t
                  ? 'bg-blue-900/50 border-blue-700 text-blue-300'
                  : 'bg-surface-card border-surface-border text-gray-600 hover:text-gray-300'
              )}
            >
              {t === 'all' ? 'Все' : t}
            </button>
          ))}
        </div>

        {/* loco list */}
        <div className="grid grid-cols-1 gap-2">
          {filtered.map(([id, meta]) => (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className="group w-full text-left bg-surface-card border border-surface-border rounded-xl px-4 py-3
                         hover:border-gray-300 hover:bg-surface-hover transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-surface border border-surface-border flex-shrink-0">
                  <span className="text-xs font-mono font-bold text-gray-600">
                    {meta.type === 'KZ8A' ? '⚡' : '🛤️'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-900 text-sm">{id}</span>
                    <span className={clsx(
                      'text-xs font-mono px-1.5 py-0.5 rounded border',
                      meta.type === 'KZ8A'
                        ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800'
                        : 'bg-blue-900/30 text-blue-400 border-blue-800'
                    )}>
                      {meta.type}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-gray-600 mt-0.5">{meta.label}</div>
                </div>
                <span className="text-slate-500 group-hover:text-gray-300 font-mono text-sm transition-colors">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
