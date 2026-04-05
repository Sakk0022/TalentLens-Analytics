import type { Alert } from '@/types'
import { clsx } from 'clsx'

export function AlertList({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm font-mono py-2">
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
        Все системы в норме
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {alerts.map(a => (
        <div
          key={a.id}
          className={clsx(
            'flex items-start gap-2 rounded-md px-3 py-2 text-sm font-mono border',
            a.level === 'critical'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          )}
        >
          <span
            className={clsx(
              'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
              a.level === 'critical' ? 'bg-red-500' : 'bg-amber-500'
            )}
          />
          {a.message}
        </div>
      ))}
    </div>
  )
}