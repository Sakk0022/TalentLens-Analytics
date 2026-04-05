// src/mock/simulator.ts
// Mirrors the Python backend simulator.
// When the real backend is ready, delete this file and connect useTelemetry to the WS.

import type { LocoType, ResourceType, Alert, TelemetryPayload, HealthIndex } from '@/types'

/** Real Kazakhstan railway waypoints along actual rail lines */
export const ROUTES: Record<string, [number, number][]> = {
  'LOCO-001': [
    // Астана → Қарағанды (southwest, ~250 km)
    [51.1694, 71.4491],  // Astana
    [50.8500, 71.8000],  // intermediate
    [50.5000, 72.2000],  // intermediate
    [50.0000, 72.7000],  // intermediate
    [49.8047, 73.1033],  // Karaganda
  ],
  'LOCO-002': [
    // Астана → Петропавловск (north, ~240 km)
    [51.1694, 71.4491],  // Astana
    [52.0000, 71.3000],  // intermediate
    [52.8000, 70.6000],  // intermediate
    [53.5000, 69.9000],  // intermediate
    [54.8808, 69.1846],  // Petropavlovsk
  ],
  'LOCO-003': [
    // Қарағанды → Балқаш (south, ~200 km)
    [49.8047, 73.1033],  // Karaganda (start)
    [48.8000, 73.1500],  // intermediate (south)
    [48.0000, 73.2000],  // intermediate (south-southeast)
    [47.3000, 73.2700],  // intermediate (closer to Balkash)
    [46.8497, 73.3472],  // Balkash (end)
  ],
  'LOCO-004': [
    // Астана → Екібастұз (east, ~250 km)
    [51.1694, 71.4491],  // Astana
    [51.3000, 72.5000],  // intermediate
    [51.4500, 73.8000],  // intermediate
    [51.5500, 74.5000],  // intermediate
    [51.6833, 75.2833],  // Ekibastuz
  ],
}

export const LOCO_META: Record<string, { label: string; type: LocoType }> = {
  'LOCO-001': { label: 'Астана → Қарағанды', type: 'TE33A' },
  'LOCO-002': { label: 'Астана → Петропавловск', type: 'KZ8A' },
  'LOCO-003': { label: 'Қарағанды → Балқаш', type: 'TE33A' },
  'LOCO-004': { label: 'Астана → Екібастұз', type: 'KZ8A' },
}

interface LocoSeed {
  id: string
  type: LocoType
  routeIndex: number
  routeProgress: number
  lat: number
  lon: number
  speed: number
  engineTemp: number
  oilTemp: number
  pressure: number
  resource: number
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const drift = (v: number, d: number) => v + (Math.random() - 0.5) * d

function initSeed(id: string, type: LocoType, startIdx: number): LocoSeed {
  const route = ROUTES[id]
  const [lat, lon] = route[startIdx]
  return {
    id, type, routeIndex: startIdx, routeProgress: 0, lat, lon,
    speed: 60 + Math.random() * 40,
    engineTemp: 85 + Math.random() * 10,
    oilTemp: 78 + Math.random() * 8,
    pressure: 5.0 + Math.random() * 0.8,
    resource: 50 + Math.random() * 40,
  }
}

const state: LocoSeed[] = [
  initSeed('LOCO-001', 'TE33A', 0),  // Start exactly at first waypoint (Astana)
  initSeed('LOCO-002', 'KZ8A', 0),   // Start exactly at first waypoint (Astana)
  initSeed('LOCO-003', 'TE33A', 0),  // Start exactly at first waypoint (Karaganda)
  initSeed('LOCO-004', 'KZ8A', 0),   // Start exactly at first waypoint (Astana)
]

function advanceAlongRoute(seed: LocoSeed): void {
  const route = ROUTES[seed.id]
  if (!route || route.length < 2) return
  seed.routeProgress += 0.003
  if (seed.routeProgress >= 1) {
    seed.routeProgress = 0
    seed.routeIndex = (seed.routeIndex + 1) % (route.length - 1)
  }
  const a = route[seed.routeIndex]
  const b = route[seed.routeIndex + 1] ?? route[seed.routeIndex]
  const t = seed.routeProgress
  seed.lat = a[0] + (b[0] - a[0]) * t
  seed.lon = a[1] + (b[1] - a[1]) * t
}

function computeHealthIndex(seed: LocoSeed): HealthIndex {
  const factors: { name: string; penalty: number }[] = []
  const tempPenalty = seed.engineTemp > 100 ? (seed.engineTemp - 100) * 1.5 : 0
  if (tempPenalty > 0) factors.push({ name: 'Перегрев двигателя', penalty: Math.round(tempPenalty) })
  const presPenalty = seed.pressure > 6.0 ? (seed.pressure - 6.0) * 5 : 0
  if (presPenalty > 0) factors.push({ name: 'Давление выше нормы', penalty: Math.round(presPenalty) })
  const resPenalty = seed.resource < 20 ? (20 - seed.resource) * 0.5 : 0
  if (resPenalty > 0) factors.push({ name: seed.type === 'TE33A' ? 'Низкий уровень топлива' : 'Низкий заряд', penalty: Math.round(resPenalty) })
  const speedPenalty = seed.speed > 110 ? (seed.speed - 110) * 0.3 : 0
  if (speedPenalty > 0) factors.push({ name: 'Скорость выше нормы', penalty: Math.round(speedPenalty) })
  const score = clamp(Math.round(100 - tempPenalty - presPenalty - resPenalty - speedPenalty), 0, 100)
  let status: HealthIndex['status'] = 'normal'
  let recommendation = 'Все параметры в норме. Продолжайте движение.'
  if (score < 60) { status = 'critical'; recommendation = 'Требуется немедленная остановка для технического обслуживания.' }
  else if (score < 80) { status = 'warning'; recommendation = 'Рекомендуется снизить скорость и проверить параметры.' }
  return { score, status, factors: factors.slice(0, 3), recommendation }
}

function buildAlerts(seed: LocoSeed): Alert[] {
  const alerts: Alert[] = []
  if (seed.engineTemp > 100) alerts.push({ id: 'temp', level: 'critical', message: `Перегрев: ${seed.engineTemp.toFixed(1)}°C`, timestamp: new Date().toISOString() })
  if (seed.pressure > 6.0) alerts.push({ id: 'pres', level: 'warning', message: `Давление: ${seed.pressure.toFixed(1)} бар`, timestamp: new Date().toISOString() })
  if (seed.resource < 20) alerts.push({ id: 'res', level: 'warning', message: `${seed.type === 'TE33A' ? 'Топливо' : 'Заряд'}: ${seed.resource.toFixed(0)}%`, timestamp: new Date().toISOString() })
  return alerts
}

export function tickAll(): TelemetryPayload[] {
  return state.map(seed => {
    advanceAlongRoute(seed)
    seed.speed = clamp(drift(seed.speed, 6), 30, 120)
    seed.engineTemp = clamp(drift(seed.engineTemp, 2), 70, 115)
    seed.oilTemp = clamp(drift(seed.oilTemp, 1.5), 60, 105)
    seed.pressure = clamp(drift(seed.pressure, 0.15), 4.0, 7.0)
    if (seed.type === 'TE33A') seed.resource = clamp(seed.resource - 0.04, 0, 100)
    return {
      locomotive_id: seed.id,
      locomotive_type: seed.type,
      timestamp: new Date().toISOString(),
      speed_kmh: parseFloat(seed.speed.toFixed(1)),
      resource_level: parseFloat(seed.resource.toFixed(1)),
      resource_type: (seed.type === 'TE33A' ? 'fuel' : 'energy') as ResourceType,
      engine_temp_c: parseFloat(seed.engineTemp.toFixed(1)),
      oil_temp_c: parseFloat(seed.oilTemp.toFixed(1)),
      pressure_bar: parseFloat(seed.pressure.toFixed(2)),
      alerts: buildAlerts(seed),
      lat: parseFloat(seed.lat.toFixed(5)),
      lon: parseFloat(seed.lon.toFixed(5)),
      health_index: computeHealthIndex(seed),
      history: [],
    }
  })
}
