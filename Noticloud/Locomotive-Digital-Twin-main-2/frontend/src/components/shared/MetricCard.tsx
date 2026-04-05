import { clsx } from 'clsx'

interface Props {
  label: string
  value: string | number
  unit?: string
  alert?: boolean
  warn?: boolean
}

export function MetricCard({ label, value, unit, alert, warn }: Props) {
  return (
    <div
      className={clsx(
        'rounded-lg p-3 border flex flex-col gap-1 transition-colors shadow-soft',
        alert
          ? 'bg-red-50 border-red-200'
          : warn
            ? 'bg-amber-50 border-amber-200'
            : 'bg-surface-card border-surface-border'
      )}
    >
      <span className="text-xs text-slate-500 font-mono">{label}</span>
      <div className="flex items-baseline gap-1">
        <span
          className={clsx(
            'text-lg font-semibold font-mono',
            alert ? 'text-red-700' : warn ? 'text-amber-700' : 'text-slate-900'
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
    </div>
  )
}