// src/components/dispatcher/FleetSummary.tsx

import type { FleetSummary as FS } from '@/types'

export function FleetSummary({ summary }: { summary: FS }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[
        { label: 'Всего', value: summary.total, color: 'text-gray-300' },
        { label: 'Норма', value: summary.normal, color: 'text-green-400' },
        { label: 'Внимание', value: summary.warning, color: 'text-yellow-400' },
        { label: 'Критично', value: summary.critical, color: 'text-red-400' },
      ].map(s => (
        <div key={s.label} className="bg-surface-card border border-surface-border rounded-lg p-2 text-center">
          <div className={`text-xl font-semibold font-mono ${s.color}`}>{s.value}</div>
          <div className="text-xs font-mono text-slate-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  )
}
