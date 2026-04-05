// src/hooks/useTelemetry.ts

import { useEffect, useState, useCallback } from 'react'
import { telemetryService } from '@/services/telemetryService'
import type { LocomotiveState, FleetSummary } from '@/types'

const HISTORY_LIMIT = 60 // data points kept per loco

function merge(prev: Map<string, LocomotiveState>, payloads: LocomotiveState[]): Map<string, LocomotiveState> {
  const next = new Map(prev)
  for (const p of payloads) {
    const existing = next.get(p.locomotive_id)
    const historyEntry = {
      timestamp: p.timestamp,
      speed_kmh: p.speed_kmh,
      engine_temp_c: p.engine_temp_c,
      oil_temp_c: p.oil_temp_c,
      pressure_bar: p.pressure_bar,
      resource_level: p.resource_level,
      oil_pressure_bar: p.oil_pressure_bar,
      brake_pressure_bar: p.brake_pressure_bar,
    }
    const history = existing
      ? [...existing.history.slice(-(HISTORY_LIMIT - 1)), historyEntry]
      : [historyEntry]
    next.set(p.locomotive_id, { ...p, history })
  }
  return next
}

export function useTelemetry() {
  const [locos, setLocos] = useState<Map<string, LocomotiveState>>(new Map())

  useEffect(() => {
    const unsub = telemetryService.subscribe(payloads => {
      setLocos(prev => merge(prev, payloads))
    })
    return unsub
  }, [])

  const locoList = Array.from(locos.values()).sort((a, b) => {
    const priority = { critical: 0, warning: 1, normal: 2 }
    const byStatus = priority[a.health_index.status] - priority[b.health_index.status]
    if (byStatus !== 0) return byStatus
    return a.locomotive_id.localeCompare(b.locomotive_id)
  })

  const summary: FleetSummary = {
    total: locoList.length,
    normal: locoList.filter(l => l.health_index.status === 'normal').length,
    warning: locoList.filter(l => l.health_index.status === 'warning').length,
    critical: locoList.filter(l => l.health_index.status === 'critical').length,
  }

  const getLoco = useCallback((id: string) => locos.get(id), [locos])

  return { locos: locoList, getLoco, summary }
}
