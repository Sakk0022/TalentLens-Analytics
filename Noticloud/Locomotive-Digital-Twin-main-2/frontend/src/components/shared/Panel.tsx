import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface Props {
  title?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}

export function Panel({ title, children, className, action }: Props) {
  return (
    <div className={clsx(
      'bg-surface-card border border-surface-border rounded-xl p-3 shadow-soft',
      className
    )}>
      {title && (
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            {title}
          </span>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}