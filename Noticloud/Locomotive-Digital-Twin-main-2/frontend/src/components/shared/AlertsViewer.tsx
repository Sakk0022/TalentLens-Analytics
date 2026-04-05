import { useState, useEffect } from 'react'
import { getAlerts, healthcheck } from '@/services/api'
import { clsx } from 'clsx'

interface AlertRecord {
  id: number
  locomotive_id: string
  locomotive_type: string
  timestamp: string
  alert_type: string
  alert_code: string
  alert_message: string
  severity: 'warning' | 'critical'
}

interface HealthStatus {
  status: string
  uptime?: number
  database?: string
  websocket?: string
}

export function AlertsViewer() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'warning' | 'critical'>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    loadAlerts()
    checkHealth()

    const interval = autoRefresh ? setInterval(() => loadAlerts(), 5000) : null
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  const loadAlerts = async () => {
    try {
      const data = await getAlerts()
      setAlerts(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }

  const checkHealth = async () => {
    try {
      const data = await healthcheck()
      setHealthStatus(data)
    } catch (err) {
      console.error('Health check failed:', err)
    }
  }

  const filtered = alerts.filter(a =>
    filterSeverity === 'all' ? true : a.severity === filterSeverity
  )

  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
  }

  return (
    <div className="w-full h-full flex flex-col bg-surface text-slate-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-border bg-white/90 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-mono font-semibold">Система алертов</h2>
            <p className="text-xs font-mono text-slate-500 mt-1">
              Всего: {stats.total} | 🔴 Critical: {stats.critical} | 🟡 Warning: {stats.warning}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-mono">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Авто-обновление
          </label>
        </div>

        {healthStatus && (
          <div className="text-xs font-mono text-slate-600 p-2 bg-slate-50 rounded border border-slate-200 mt-2">
            <div className="flex gap-4">
              <span>
                Status: <span className="text-green-600">{healthStatus.status}</span>
              </span>
              {healthStatus.database && (
                <span>
                  DB: <span className="text-blue-600">{healthStatus.database}</span>
                </span>
              )}
              {healthStatus.websocket && (
                <span>
                  WS: <span className="text-blue-600">{healthStatus.websocket}</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="px-4 py-3 border-b border-surface-border flex gap-2 flex-shrink-0">
        {(['all', 'warning', 'critical'] as const).map(severity => (
          <button
            key={severity}
            onClick={() => setFilterSeverity(severity)}
            className={clsx(
              'px-3 py-1 text-xs font-mono rounded-lg transition-colors',
              filterSeverity === severity
                ? severity === 'critical'
                  ? 'bg-red-600 text-white'
                  : severity === 'warning'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-600 text-white'
                : 'bg-surface-card text-slate-700 border border-surface-border hover:bg-surface-hover'
            )}
          >
            {severity === 'all' ? '📊 Все' : severity === 'critical' ? '🔴 Critical' : '🟡 Warning'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-500 font-mono">Загрузка алертов...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg font-mono text-sm mb-4">
            ⚠️ {error}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(alert => (
              <div
                key={alert.id}
                className={clsx(
                  'p-3 rounded-lg border font-mono text-sm',
                  alert.severity === 'critical'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                )}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-semibold">
                    {alert.severity === 'critical' ? '🔴' : '🟡'} {alert.alert_message}
                  </span>
                  <span className="text-xs opacity-70">
                    {new Date(alert.timestamp).toLocaleTimeString('ru-RU')}
                  </span>
                </div>
                <div className="flex gap-4 text-xs opacity-80">
                  <span>ID: {alert.locomotive_id}</span>
                  <span>Type: {alert.locomotive_type}</span>
                  <span>Code: {alert.alert_code}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-500 font-mono">
              {stats.total === 0 ? '✅ Нет активных алертов' : 'Нет алертов по фильтру'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
