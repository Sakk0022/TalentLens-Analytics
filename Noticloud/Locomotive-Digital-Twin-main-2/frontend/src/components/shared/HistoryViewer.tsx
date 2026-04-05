import { useState, useEffect } from 'react'
import { getHistory, getCsvReportUrl } from '@/services/api'

interface HistoryEntry {
  id: number
  locomotive_id: string
  locomotive_type: string
  timestamp: string
  speed_kmh: number
  fuel_percent?: number | null
  engine_temp_c: number
  oil_temp_c: number
  pressure_bar: number
}

export function HistoryViewer() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('')

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      setLoading(true)
      const data = await getHistory()
      setHistory(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  const filtered = history.filter(h =>
    filter === '' || h.locomotive_id.includes(filter)
  )

  const fmt = (v: number | undefined | null, digits = 2) => {
    if (v === undefined || v === null || Number.isNaN(v)) return '-'
    return v.toFixed(digits)
  }

  const handleExportCsv = () => {
    const url = getCsvReportUrl()
    window.open(url, '_blank')
  }

  return (
    <div className="w-full h-full flex flex-col bg-surface text-slate-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-border bg-white/90 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-mono font-semibold">История телеметрии</h2>
            <p className="text-xs font-mono text-slate-500 mt-1">
              {filtered.length} записей
            </p>
          </div>
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 text-xs font-mono bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            📥 Экспорт CSV
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 py-3 border-b border-surface-border flex-shrink-0">
        <input
          type="text"
          placeholder="Фильтр по ID локомотива..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full px-3 py-2 text-sm font-mono border border-surface-border rounded-lg bg-white focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-500 font-mono">Загрузка истории...</div>
          </div>
        )}

        {error && (
          <div className="m-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg font-mono text-sm">
            ⚠️ {error}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="bg-slate-100 border-b border-surface-border sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-600">ID</th>
                  <th className="px-4 py-2 text-left text-slate-600">Тип</th>
                  <th className="px-4 py-2 text-left text-slate-600">Время</th>
                  <th className="px-4 py-2 text-right text-slate-600">Скорость км/ч</th>
                  <th className="px-4 py-2 text-right text-slate-600">Т° двиг.</th>
                  <th className="px-4 py-2 text-right text-slate-600">Т° масла</th>
                  <th className="px-4 py-2 text-right text-slate-600">Давл. бар</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => (
                  <tr
                    key={entry.id}
                    className="border-b border-surface-border hover:bg-slate-50"
                  >
                    <td className="px-4 py-2 text-slate-900">{entry.locomotive_id}</td>
                    <td className="px-4 py-2 text-slate-900">{entry.locomotive_type}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {new Date(entry.timestamp).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-900">
                      {fmt(entry.speed_kmh, 1)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-900">
                      {fmt(entry.engine_temp_c, 1)}°C
                    </td>
                    <td className="px-4 py-2 text-right text-slate-900">
                      {fmt(entry.oil_temp_c, 1)}°C
                    </td>
                    <td className="px-4 py-2 text-right text-slate-900">
                      {fmt((entry as any).pressure_bar ?? (entry as any).pressure ?? null, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-500 font-mono">
              {history.length === 0 ? 'История пуста' : 'Нет результатов по фильтру'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
