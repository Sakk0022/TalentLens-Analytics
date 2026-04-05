import { useState, useEffect } from 'react'
import { getConfig, updateConfigParameter } from '@/services/api'
import type { LocoType } from '@/types'
import { clsx } from 'clsx'

export function ConfigManager() {
  // `getConfig()` returns { profiles: [...] } where each profile has `params`
  const [profiles, setProfiles] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<LocoType>('TE33A')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<{
    warning_min: number | null
    warning_max: number | null
    critical_min: number | null
    critical_max: number | null
    weight: number
  } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      setLoading(true)
      const data = await getConfig()
      // expect { profiles: [...] }
      setProfiles(data?.profiles ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config')
    } finally {
      setLoading(false)
    }
  }

  const currentProfile = (profiles ?? []).find(p => p.locomotive_type === selectedType)
  const filteredConfigs = currentProfile?.params ?? []

  const handleEdit = (config: any) => {
    // use parameter string as editing id
    setEditingId(config.parameter)
    setEditValues({
      warning_min: config.warning ? config.warning[0] : null,
      warning_max: config.warning ? config.warning[1] : null,
      critical_min: config.critical ? config.critical[0] : null,
      critical_max: config.critical ? config.critical[1] : null,
      weight: (config.weight as number) ?? 0.1,
    })
  }

  const handleSave = async (config: any) => {
    if (!editValues) return
    try {
      setSaving(true)
      await updateConfigParameter(selectedType, config.parameter, editValues)
      // update local profiles state
      setProfiles(prev => {
        if (!prev) return prev
        return prev.map((p: any) => {
          if (p.locomotive_type !== selectedType) return p
          return {
            ...p,
            params: p.params.map((param: any) =>
              param.parameter === config.parameter
                ? {
                    ...param,
                    warning: [editValues.warning_min, editValues.warning_max],
                    critical: [editValues.critical_min, editValues.critical_max],
                    weight: editValues.weight,
                  }
                : param
            ),
          }
        })
      })
      setEditingId(null)
      setEditValues(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditValues(null)
  }

  return (
    <div className="w-full h-full flex flex-col bg-surface text-slate-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-border bg-white/90 backdrop-blur-sm flex-shrink-0">
        <h2 className="text-lg font-mono font-semibold">Конфигурация параметров</h2>
        <p className="text-xs font-mono text-slate-500 mt-1">
          Управление порогами и весами параметров для расчета Health Index
        </p>
      </div>

      {/* Type selector */}
      <div className="px-4 py-3 border-b border-surface-border flex gap-2 flex-shrink-0">
        {['TE33A', 'KZ8A'].map(type => (
          <button
            key={type}
            onClick={() => {
              setSelectedType(type as LocoType)
              setEditingId(null)
            }}
            className={clsx(
              'px-4 py-2 rounded-lg font-mono text-sm transition-colors',
              selectedType === type
                ? 'bg-blue-600 text-white border border-blue-700'
                : 'bg-surface-card text-slate-700 border border-surface-border hover:bg-surface-hover'
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-500 font-mono">Загрузка конфигурации...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg font-mono text-sm mb-4">
            ⚠️ {error}
          </div>
        )}

        {!loading && filteredConfigs.length > 0 && (
          <div className="space-y-3">
            {filteredConfigs.map((config: any) => {
              const isEditing = editingId === config.id
              return (
                <div
                  key={config.id}
                  className="bg-surface-card border border-surface-border rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-mono font-semibold text-sm">{config.label}</h3>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">
                        {config.parameter} ({config.unit})
                      </p>
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => handleEdit(config)}
                        className="px-2 py-1 text-xs font-mono bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        Редактировать
                      </button>
                    )}
                  </div>

                  {isEditing && editValues ? (
                    <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-mono text-slate-600 block mb-1">
                            Warning Min
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={editValues.warning_min ?? ''}
                            onChange={e =>
                              setEditValues({
                                ...editValues,
                                warning_min: e.target.value ? parseFloat(e.target.value) : null,
                              })
                            }
                            className="w-full px-2 py-1 text-sm font-mono border border-slate-300 rounded bg-white"
                            placeholder="—"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-mono text-slate-600 block mb-1">
                            Warning Max
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={editValues.warning_max ?? ''}
                            onChange={e =>
                              setEditValues({
                                ...editValues,
                                warning_max: e.target.value ? parseFloat(e.target.value) : null,
                              })
                            }
                            className="w-full px-2 py-1 text-sm font-mono border border-slate-300 rounded bg-white"
                            placeholder="—"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-mono text-slate-600 block mb-1">
                            Critical Min
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={editValues.critical_min ?? ''}
                            onChange={e =>
                              setEditValues({
                                ...editValues,
                                critical_min: e.target.value ? parseFloat(e.target.value) : null,
                              })
                            }
                            className="w-full px-2 py-1 text-sm font-mono border border-slate-300 rounded bg-white"
                            placeholder="—"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-mono text-slate-600 block mb-1">
                            Critical Max
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={editValues.critical_max ?? ''}
                            onChange={e =>
                              setEditValues({
                                ...editValues,
                                critical_max: e.target.value ? parseFloat(e.target.value) : null,
                              })
                            }
                            className="w-full px-2 py-1 text-sm font-mono border border-slate-300 rounded bg-white"
                            placeholder="—"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-mono text-slate-600 block mb-1">
                            Вес параметра
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={editValues.weight}
                            onChange={e =>
                              setEditValues({
                                ...editValues,
                                weight: parseFloat(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1 text-sm font-mono border border-slate-300 rounded bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={handleCancel}
                          disabled={saving}
                          className="px-3 py-1 text-xs font-mono bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors disabled:opacity-50"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={() => handleSave(config)}
                          disabled={saving}
                          className="px-3 py-1 text-xs font-mono bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {saving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block mb-1">Warning</span>
                        <span className="text-slate-900">
                          {config.warning_min != null ? Number(config.warning_min).toFixed(2) : '—'} ÷{' '}
                          {config.warning_max != null ? Number(config.warning_max).toFixed(2) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Critical</span>
                        <span className="text-slate-900">
                          {config.critical_min != null ? Number(config.critical_min).toFixed(2) : '—'} ÷{' '}
                          {config.critical_max != null ? Number(config.critical_max).toFixed(2) : '—'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 block mb-1">Вес</span>
                        <span className="text-slate-900">{(config.weight ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!loading && filteredConfigs.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-500 font-mono">Нет параметров для {selectedType}</div>
          </div>
        )}
      </div>
    </div>
  )
}
