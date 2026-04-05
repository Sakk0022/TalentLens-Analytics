// src/App.tsx

import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTelemetry } from '@/hooks/useTelemetry'
import { fetchMetrics, getAlerts, getConfig, getCsvReportUrl, getHealth, getPdfReportUrl, healthcheck, login as apiLogin, me as apiMe } from '@/services/api'
import type { HealthStatus, LocoType, LocomotiveState, UserRole } from '@/types'

type Page = 'login' | 'landing' | 'select' | 'driver' | 'dispatcher' | 'detail'
type DriverTab = 'map' | 'status'
type DispatcherTab = 'map' | 'fleet'
type SelectFilter = 'all' | LocoType
type ChatRole = 'sys' | 'user' | 'bot'

interface CityPoint {
  x: number
  y: number
}

interface GeoPoint {
  lat: number
  lon: number
}

interface HazardZone {
  id: string
  cx: number
  cy: number
  r: number
  type: 'danger' | 'warning'
  name: string
  speedLimit: number
}

interface RoutePreset {
  from: keyof typeof CITY_POINTS
  to: keyof typeof CITY_POINTS
  wagons: number
  cargo: number
  locomotiveMass: number
  driver: string
  cargoType: string
  maxSpeed: number
}

interface DisplayLoco extends LocomotiveState {
  routeMeta: RoutePreset
  routeKey: string
  routeLabel: string
  progress: number
  from: RoutePreset['from']
  to: RoutePreset['to']
  wagons: number
  cargo: number
  locomotiveMass: number
  maxSpeed: number
  driver: string
  cargoType: string
  status: HealthStatus
  statusText: string
  badgeClass: string
  avatarClass: string
  icon: string
  color: string
  resourcePercent: number | null
  errorTexts: string[]
  healthScore: number
}

interface ChatMessage {
  id: string
  role: ChatRole
  text: string
}

interface PhysicsData {
  totalMassTons: number
  rollingResistanceKn: number
  aeroDragKn: number
  tractionKn: number
  maxTractionKn: number
  loadPercent: number
  fuelPerKm: number | null
  fuelPerHour: number | null
  estimatedRangeKm: number | null
}

interface BackendOverview {
  apiOnline: boolean
  configCount: number
  alertsCount: number
  healthCount: number
  metricsReady: boolean
}

const CITY_POINTS = {
  'Астана': { x: 520, y: 140 },
  'Қарағанды': { x: 558, y: 192 },
  'Петропавловск': { x: 452, y: 36 },
  'Балқаш': { x: 598, y: 268 },
  'Екібастұз': { x: 604, y: 130 },
  'Шымкент': { x: 466, y: 372 },
  'Алматы': { x: 642, y: 348 },
  'Актобе': { x: 178, y: 172 },
  'Атырау': { x: 46, y: 270 },
  'Семей': { x: 714, y: 168 },
  'Павлодар': { x: 668, y: 96 },
} satisfies Record<string, CityPoint>

const GEO_POINTS: Record<string, GeoPoint> = {
  'Астана': { lat: 51.18, lon: 71.45 },
  'Қарағанды': { lat: 49.8, lon: 73.1 },
  'Петропавловск': { lat: 54.87, lon: 69.16 },
  'Балқаш': { lat: 46.84, lon: 74.98 },
  'Екібастұз': { lat: 51.72, lon: 75.32 },
  'Шымкент': { lat: 42.32, lon: 69.59 },
  'Алматы': { lat: 43.25, lon: 76.95 },
  'Актобе': { lat: 50.28, lon: 57.17 },
  'Атырау': { lat: 47.11, lon: 51.92 },
  'Семей': { lat: 50.41, lon: 80.25 },
  'Павлодар': { lat: 52.29, lon: 76.97 },
}

const ROUTES_BG: Array<[keyof typeof CITY_POINTS, keyof typeof CITY_POINTS]> = [
  ['Астана', 'Қарағанды'],
  ['Астана', 'Петропавловск'],
  ['Қарағанды', 'Балқаш'],
  ['Астана', 'Екібастұз'],
  ['Шымкент', 'Алматы'],
  ['Астана', 'Актобе'],
  ['Екібастұз', 'Семей'],
  ['Астана', 'Павлодар'],
  ['Актобе', 'Атырау'],
]

const DISTANCES: Record<string, number> = {
  'Астана-Қарағанды': 202,
  'Астана-Петропавловск': 305,
  'Қарағанды-Балқаш': 342,
  'Астана-Екібастұз': 198,
  'Шымкент-Алматы': 618,
  'Астана-Актобе': 980,
  'Екібастұз-Семей': 410,
  'Астана-Павлодар': 453,
  'Актобе-Атырау': 563,
}

const HAZARDS: HazardZone[] = [
  { id: 'hz1', cx: 571, cy: 215, r: 48, type: 'danger', name: 'Скот на путях', speedLimit: 40 },
  { id: 'hz2', cx: 510, cy: 155, r: 38, type: 'warning', name: 'Туман / Осадки', speedLimit: 60 },
  { id: 'hz3', cx: 558, cy: 280, r: 32, type: 'warning', name: 'Ремонт пути', speedLimit: 50 },
]

const ROUTE_PRESETS: Record<LocoType, RoutePreset[]> = {
  TE33A: [
    { from: 'Астана', to: 'Қарағанды', wagons: 18, cargo: 1250, locomotiveMass: 138, driver: 'Асқар Нұрланов', cargoType: 'Уголь', maxSpeed: 120 },
    { from: 'Қарағанды', to: 'Балқаш', wagons: 15, cargo: 980, locomotiveMass: 138, driver: 'Дамир Жаксыбеков', cargoType: 'Металл', maxSpeed: 120 },
    { from: 'Шымкент', to: 'Алматы', wagons: 12, cargo: 860, locomotiveMass: 138, driver: 'Айбек Токтасынов', cargoType: 'Смешанный', maxSpeed: 120 },
  ],
  KZ8A: [
    { from: 'Астана', to: 'Петропавловск', wagons: 22, cargo: 1680, locomotiveMass: 200, driver: 'Берік Сейткали', cargoType: 'Зерно', maxSpeed: 200 },
    { from: 'Астана', to: 'Екібастұз', wagons: 20, cargo: 1420, locomotiveMass: 200, driver: 'Ерлан Мусин', cargoType: 'Нефть', maxSpeed: 200 },
    { from: 'Астана', to: 'Павлодар', wagons: 24, cargo: 1760, locomotiveMass: 200, driver: 'Нұрбек Есімов', cargoType: 'Контейнеры', maxSpeed: 200 },
  ],
}

const KAZAKHSTAN_PATH = 'M57,48 L195,48 L318,20 L388,48 L434,20 L506,78 L578,48 L670,78 L768,108 L838,166 L838,200 L815,260 L670,340 L648,375 L578,375 L462,390 L328,390 L184,390 L128,370 L80,340 L55,290 L32,250 L32,196 L32,138 L32,82 L57,48 Z'

const CHAT_SUGGESTIONS = [
  'Статус выбранного локомотива?',
  'Какие сейчас зоны риска?',
  'Что критично по парку?',
  'Рекомендации машинисту',
]

const INITIAL_CHAT: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'sys',
    text: 'Добро пожаловать в КТЖ ИИ-Ассистент. Я анализирую текущую телеметрию и даю краткие рекомендации по локомотивам.',
  },
]

function statusText(status: HealthStatus) {
  if (status === 'critical') return 'Критично'
  if (status === 'warning') return 'Внимание'
  return 'Норма'
}

function statusColor(status: HealthStatus) {
  if (status === 'critical') return 'var(--rd)'
  if (status === 'warning') return 'var(--or)'
  return 'var(--ok)'
}

function statusBadgeClass(status: HealthStatus) {
  if (status === 'critical') return 'sp-crit'
  if (status === 'warning') return 'sp-warn'
  return 'sp-ok'
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function hashString(value: string) {
  return value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
}

function getRoutePreset(loco: LocomotiveState): RoutePreset {
  const presets = ROUTE_PRESETS[loco.locomotive_type]
  return presets[hashString(loco.locomotive_id) % presets.length]
}

function estimateProgress(loco: LocomotiveState, preset: RoutePreset) {
  const from = GEO_POINTS[preset.from]
  const to = GEO_POINTS[preset.to]
  if (!from || !to) return clamp((loco.step ?? 0) / 100, 0.02, 0.98)

  const vx = to.lon - from.lon
  const vy = to.lat - from.lat
  const wx = loco.lon - from.lon
  const wy = loco.lat - from.lat
  const denominator = vx * vx + vy * vy
  if (denominator === 0) return 0.2
  return clamp((wx * vx + wy * vy) / denominator, 0.02, 0.98)
}

function computePhysics(loco: DisplayLoco): PhysicsData {
  const totalMassTons = Math.round(loco.locomotiveMass + loco.cargo + loco.wagons * 22)
  const totalMassKg = totalMassTons * 1000
  const velocity = loco.speed_kmh / 3.6
  const rollingResistanceKn = (totalMassKg * 9.81 * 0.002) / 1000
  const aeroDragKn = (0.5 * 1.225 * 0.8 * 10 * velocity * velocity) / 1000
  const tractionKn = rollingResistanceKn + aeroDragKn
  const maxTractionKn = loco.locomotive_type === 'KZ8A' ? 690 : 392
  const loadPercent = clamp((tractionKn / maxTractionKn) * 100, 0, 99)
  const fuelPerKm = loco.locomotive_type === 'TE33A'
    ? 1.2 * (1 + (loadPercent / 100) * 1.8) * Math.pow(Math.max(loco.speed_kmh, 1) / 80, 1.15)
    : null
  const fuelPerHour = fuelPerKm == null ? null : fuelPerKm * Math.max(loco.speed_kmh, 1)
  const remainingFuelLiters = loco.locomotive_type === 'TE33A'
    ? (loco.fuel_liters ?? ((loco.fuel_percent ?? loco.resource_level) / 100) * 3000)
    : null
  const estimatedRangeKm = fuelPerKm && remainingFuelLiters != null
    ? remainingFuelLiters / fuelPerKm
    : null

  return {
    totalMassTons,
    rollingResistanceKn,
    aeroDragKn,
    tractionKn,
    maxTractionKn,
    loadPercent,
    fuelPerKm,
    fuelPerHour,
    estimatedRangeKm,
  }
}

function getHazards(loco: DisplayLoco) {
  const from = CITY_POINTS[loco.from]
  const to = CITY_POINTS[loco.to]
  const x = from.x + (to.x - from.x) * loco.progress
  const y = from.y + (to.y - from.y) * loco.progress
  return HAZARDS.filter(hazard => {
    const dx = x - hazard.cx
    const dy = y - hazard.cy
    return Math.sqrt(dx * dx + dy * dy) < hazard.r + 35
  })
}

function createDisplayLoco(loco: LocomotiveState): DisplayLoco {
  const routeMeta = getRoutePreset(loco)
  const status = loco.health_index.status
  const icon = loco.locomotive_type === 'KZ8A' ? '⚡' : '🚂'
  const resourcePercent = loco.locomotive_type === 'TE33A'
    ? (loco.fuel_percent ?? loco.resource_level)
    : null

  return {
    ...loco,
    routeMeta,
    routeKey: `${routeMeta.from}-${routeMeta.to}`,
    routeLabel: `${routeMeta.from} → ${routeMeta.to}`,
    progress: estimateProgress(loco, routeMeta),
    from: routeMeta.from,
    to: routeMeta.to,
    wagons: routeMeta.wagons,
    cargo: routeMeta.cargo,
    locomotiveMass: routeMeta.locomotiveMass,
    maxSpeed: routeMeta.maxSpeed,
    driver: routeMeta.driver,
    cargoType: routeMeta.cargoType,
    status,
    statusText: statusText(status),
    badgeClass: statusBadgeClass(status),
    avatarClass: loco.locomotive_type === 'KZ8A' ? 'av-kz' : 'av-te',
    icon,
    color: statusColor(status),
    resourcePercent: resourcePercent == null ? null : clamp(resourcePercent, 0, 100),
    errorTexts: loco.alerts.map(alert => `${alert.code ? `${alert.code} · ` : ''}${alert.message}`),
    healthScore: Math.round(loco.health_index.score),
  }
}

function formatEta(hours: number) {
  if (!Number.isFinite(hours) || hours < 0) return '—'
  const fullHours = Math.floor(hours)
  const minutes = Math.round((hours % 1) * 60)
  return `~${fullHours}ч ${minutes}мин`
}

function buildAiAnswer(query: string, locos: DisplayLoco[], focused?: DisplayLoco | null) {
  const normalized = query.toLowerCase()
  const critical = locos.filter(loco => loco.status === 'critical')
  const warnings = locos.filter(loco => loco.status === 'warning')
  const target = focused ?? locos.find(loco => normalized.includes(loco.locomotive_id.toLowerCase())) ?? locos[0]

  if (!target) return 'Нет данных от backend. Запустите backend и симулятор, затем обновите интерфейс.'

  const physics = computePhysics(target)
  const nearbyHazards = getHazards(target)
  const firstAlert = target.alerts[0]

  if (normalized.includes('зон') || normalized.includes('риск')) {
    if (nearbyHazards.length === 0) return `Для ${target.locomotive_id} поблизости активных зон риска нет.`
    const hazard = nearbyHazards[0]
    return `${target.locomotive_id} приближается к зоне «${hazard.name}». Рекомендуемый лимит — ${hazard.speedLimit} км/ч.`
  }

  if (normalized.includes('крит')) {
    if (critical.length === 0) return 'Критических состояний сейчас нет.'
    return `Критично: ${critical.map(loco => loco.locomotive_id).join(', ')}. Нужна немедленная реакция на alerts.`
  }

  if (normalized.includes('рекоменд')) {
    return `${target.locomotive_id}: ${target.health_index.recommendation}${nearbyHazards[0] ? `. Зона риска: ${nearbyHazards[0].name}, лимит ${nearbyHazards[0].speedLimit} км/ч.` : '.'}`
  }

  if (normalized.includes('топлив') || normalized.includes('эконом')) {
    if (target.resourcePercent == null || physics.fuelPerKm == null) return `${target.locomotive_id} — электровоз. Контролируйте тяговую нагрузку ${physics.loadPercent.toFixed(1)}% и тормозной контур.`
    return `${target.locomotive_id}: остаток топлива ${target.resourcePercent.toFixed(1)}%, расчетный расход ${physics.fuelPerKm.toFixed(2)} л/км.`
  }

  if (normalized.includes('статус') || normalized.includes('локомотив')) {
    return `${target.locomotive_id}: ${target.statusText.toLowerCase()}, health ${target.healthScore}, скорость ${Math.round(target.speed_kmh)} км/ч, alerts ${target.alerts.length}.`
  }

  return `В парке: ${locos.length}, критичных ${critical.length}, предупреждений ${warnings.length}. ${firstAlert ? `${target.locomotive_id}: ${firstAlert.message}.` : `${target.locomotive_id}: значимых отклонений немного.`}`
}

function buildWagons(loco: DisplayLoco) {
  const average = loco.cargo / loco.wagons
  const base = hashString(loco.locomotive_id)
  return Array.from({ length: loco.wagons }, (_, index) => {
    const modifier = 0.86 + ((base + index * 17) % 28) / 100
    const load = Math.round(average * modifier)
    const ratio = load / 90
    const state = ratio > 0.95 ? 'w-crit' : ratio > 0.8 ? 'w-warn' : 'w-ok'
    return { number: index + 1, load, state }
  })
}

function TopLogo({ title }: { title?: string }) {
  return (
        <div className="tb-logo">
          <div className="tb-lm">КТЖ</div>
          {title ? <div className="tb-lt">{title}</div> : null}
        </div>
  )
}

function GaugeCanvas({ score, color }: { score: number; color: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
        const canvas = ref.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, 120, 120)
        ctx.beginPath()
        ctx.arc(60, 60, 50, -Math.PI / 2, Math.PI * 1.5)
        ctx.strokeStyle = '#E2EDF0'
        ctx.lineWidth = 8
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(60, 60, 50, -Math.PI / 2, -Math.PI / 2 + (score / 100) * Math.PI * 2)
        ctx.strokeStyle = color
        ctx.lineWidth = 8
        ctx.lineCap = 'round'
        ctx.stroke()
  }, [score, color])

  return <canvas ref={ref} width={120} height={120} />
}

function SparklineCanvas({ data, color, min, max }: { data: number[]; color: string; min: number; max: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
        const canvas = ref.current
        if (!canvas) return
        const width = canvas.clientWidth || 400
        const height = 50
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, width, height)
        if (data.length < 2) return

    const points = data.map((value, index) => ({
      x: (index / (data.length - 1)) * width,
      y: height - ((value - min) / Math.max(max - min, 1)) * (height - 6) - 3,
    }))

    ctx.beginPath()
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(points[0].x, height)
    points.forEach(point => ctx.lineTo(point.x, point.y))
    ctx.lineTo(points[points.length - 1].x, height)
    ctx.closePath()
    ctx.fillStyle = `${color}25`
    ctx.fill()
  }, [data, color, min, max])

  return <canvas ref={ref} className="trnd-cv" />
}

function MapSvg({
  locos,
  mode,
  selectedId,
  onSelect,
}: {
  locos: DisplayLoco[]
  mode: 'driver' | 'dispatch'
  selectedId?: string | null
  onSelect?: (id: string) => void
}) {
  const id = useId().replace(/:/g, '')
  const bgGradient = `bgG-${id}`
  const glowFilter = `glow-${id}`
  const shadowFilter = `shad-${id}`
  const visibleLocos = mode === 'driver' && selectedId ? locos.filter(loco => loco.locomotive_id === selectedId) : locos

  return (
    <svg className="kmap" viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={bgGradient} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#E8F0F3" /><stop offset="100%" stopColor="#D8E6EA" /></linearGradient>
        <filter id={glowFilter}><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id={shadowFilter}><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.2)" /></filter>
      </defs>
      <rect width="900" height="400" fill={`url(#${bgGradient})`} />
      {Array.from({ length: 16 }, (_, index) => index * 60).map(x => <line key={`vx-${x}`} x1={x} y1={0} x2={x} y2={400} stroke="rgba(0,150,168,0.04)" strokeWidth="1" />)}
      {Array.from({ length: 8 }, (_, index) => index * 60).map(y => <line key={`hy-${y}`} x1={0} y1={y} x2={900} y2={y} stroke="rgba(0,150,168,0.04)" strokeWidth="1" />)}
      <path d={KAZAKHSTAN_PATH} fill="rgba(255,255,255,0.8)" stroke="rgba(0,100,130,0.15)" strokeWidth="2" />
      {ROUTES_BG.map(([from, to]) => <line key={`${from}-${to}`} x1={CITY_POINTS[from].x} y1={CITY_POINTS[from].y} x2={CITY_POINTS[to].x} y2={CITY_POINTS[to].y} stroke="rgba(0,100,140,0.1)" strokeWidth="2" strokeDasharray="5 5" />)}
      {HAZARDS.map(hazard => {
        const hazardColor = hazard.type === 'danger' ? '#D63A3A' : '#D97706'
        return (
          <g key={hazard.id}>
            <circle cx={hazard.cx} cy={hazard.cy} r={hazard.r} fill={hazard.type === 'danger' ? 'rgba(214,58,58,0.08)' : 'rgba(217,119,6,0.08)'} stroke={hazardColor} strokeWidth="2" strokeDasharray="6 4" />
            <rect x={hazard.cx - 20} y={hazard.cy - 13} width="40" height="22" rx="5" fill={hazardColor} filter={`url(#${shadowFilter})`} />
            <text x={hazard.cx} y={hazard.cy + 2} textAnchor="middle" fill="#fff" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="700">! {hazard.speedLimit}км/ч</text>
            <text x={hazard.cx} y={hazard.cy + hazard.r + 12} textAnchor="middle" fill={hazardColor} fontSize="9" fontFamily="Inter, sans-serif" fontWeight="700">{hazard.name}</text>
          </g>
        )
      })}
      {visibleLocos.map(loco => {
        const from = CITY_POINTS[loco.from]
        const to = CITY_POINTS[loco.to]
        const midX = from.x + (to.x - from.x) * loco.progress
        const midY = from.y + (to.y - from.y) * loco.progress
        const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI
        const firstHazard = getHazards(loco)[0]

        return (
          <g key={`route-${loco.locomotive_id}`}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(0,0,0,0.12)" strokeWidth="9" strokeLinecap="round" />
            {mode === 'driver' ? (
              <>
                <line x1={from.x} y1={from.y} x2={midX} y2={midY} stroke="rgba(0,0,0,0.3)" strokeWidth="5" strokeLinecap="round" />
                <line x1={midX} y1={midY} x2={to.x} y2={to.y} stroke={loco.color} strokeWidth="16" opacity="0.15" strokeLinecap="round" />
                <line x1={midX} y1={midY} x2={to.x} y2={to.y} stroke={loco.color} strokeWidth="6" opacity="0.9" strokeLinecap="round" />
              </>
            ) : (
              <>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={loco.color} strokeWidth="5" opacity="0.8" strokeLinecap="round" />
                {[0.3, 0.5, 0.7].map(step => <polygon key={`${loco.locomotive_id}-${step}`} points="-5,-3 5,0 -5,3" fill={loco.color} opacity="0.7" transform={`translate(${from.x + (to.x - from.x) * step},${from.y + (to.y - from.y) * step}) rotate(${angle})`} />)}
              </>
            )}
            <circle cx={midX} cy={midY} r="14" fill="none" stroke={loco.color} strokeWidth="2" opacity="0.4"><animate attributeName="r" values="10;22;10" dur={loco.status === 'critical' ? '1s' : '2.5s'} repeatCount="indefinite" /><animate attributeName="opacity" values="0.5;0;0.5" dur={loco.status === 'critical' ? '1s' : '2.5s'} repeatCount="indefinite" /></circle>
            <g transform={`translate(${midX},${midY}) rotate(${angle})`} filter={`url(#${glowFilter})`} style={mode === 'dispatch' ? { cursor: 'pointer' } : undefined} onClick={mode === 'dispatch' ? () => onSelect?.(loco.locomotive_id) : undefined}>
              <rect x="-15" y="-7" width="30" height="14" rx="4" fill={loco.color} stroke="#fff" strokeWidth="1.5" />
              <polygon points="15,-7 23,0 15,7" fill={loco.color} stroke="#fff" strokeWidth="1" />
              <rect x="-9" y="-4" width="9" height="8" rx="2" fill="rgba(255,255,255,0.7)" />
            </g>
            <rect x={midX - 18} y={midY + 14} width="36" height="14" rx="3" fill={loco.color} stroke="#fff" strokeWidth="1" />
            <text x={midX} y={midY + 22} textAnchor="middle" fill="#fff" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="700">{Math.round(loco.speed_kmh)}км/ч</text>
            {mode === 'dispatch' ? (
              <>
                <rect x={midX - 16} y={midY - 28} width="52" height="13" rx="3" fill={loco.color} stroke="#fff" strokeWidth="1" />
                <text x={midX + 10} y={midY - 20} textAnchor="middle" fill="#fff" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="700">{loco.locomotive_id}</text>
              </>
            ) : null}
            {firstHazard ? (
              <>
                <circle cx={midX + 16} cy={midY - 16} r="9" fill={firstHazard.type === 'danger' ? '#D63A3A' : '#D97706'} stroke="#fff" strokeWidth="2" />
                <text x={midX + 16} y={midY - 12} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="900">!</text>
              </>
            ) : null}
          </g>
        )
      })}
      {Object.entries(CITY_POINTS).map(([name, city]) => (
        <g key={name}>
          <circle cx={city.x} cy={city.y} r="6" fill="rgba(0,150,168,0.15)" stroke="rgba(0,120,140,0.3)" strokeWidth="1.5" />
          <circle cx={city.x} cy={city.y} r="3" fill="rgba(0,100,130,0.6)" />
          <text x={city.x + 9} y={city.y + 4} fill="rgba(30,60,80,0.75)" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="600">{name}</text>
        </g>
      ))}
      {mode === 'dispatch' ? (
        <g>
          <rect x="10" y="10" width="155" height="84" rx="8" fill="rgba(255,255,255,0.93)" stroke="rgba(0,0,0,0.1)" strokeWidth="1" filter={`url(#${shadowFilter})`} />
          <text x="22" y="28" fill="#4A6070" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="1">ЛЕГЕНДА</text>
          {[['#0EA572', 'Норма'], ['#D97706', 'Внимание'], ['#D63A3A', 'Критично']].map(([color, label], index) => (
            <g key={label}>
              <circle cx="22" cy={42 + index * 16} r="5" fill={color} />
              <text x="32" y={46 + index * 16} fill="#334" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="500">{label}</text>
            </g>
          ))}
          <text x="22" y="96" fill="#D97706" fontSize="8" fontFamily="Inter, sans-serif" fontWeight="700">! Зоны ограничения скорости</text>
        </g>
      ) : null}
    </svg>
  )
}

function DriverStatusView({ loco }: { loco: DisplayLoco }) {
  const physics = computePhysics(loco)
  const hazards = getHazards(loco)
  const scoreColor = statusColor(loco.status)
  const speedBars = [
    { label: 'Скорость', value: Math.round(loco.speed_kmh), max: loco.maxSpeed, unit: 'км/ч', warn: loco.maxSpeed * 0.9, inverse: false },
    { label: 'Нагрузка', value: Number(physics.loadPercent.toFixed(1)), max: 100, unit: '%', warn: 70, inverse: false },
  ]
  if (loco.resourcePercent != null) speedBars.push({ label: 'Топливо', value: Number(loco.resourcePercent.toFixed(1)), max: 100, unit: '%', warn: 15, inverse: true })

  const params = [
    loco.engine_temp_c ? { label: 'Двигатель', value: loco.engine_temp_c, unit: '°C', max: 115, norm: 'до 95°C', warn: 95, inverse: false } : null,
    { label: 'Масло', value: loco.oil_temp_c, unit: '°C', max: 100, norm: 'до 88°C', warn: 88, inverse: false },
    { label: 'Давл. масла', value: loco.oil_pressure_bar ?? loco.pressure_bar, unit: 'бар', max: 7, norm: '3.5–7', warn: 3, inverse: true },
    { label: 'Тормоз', value: loco.brake_pressure_bar ?? loco.pressure_bar, unit: 'бар', max: 8, norm: '5–8', warn: 4.5, inverse: true },
    loco.voltage_aux_v ? { label: 'Напряжение', value: loco.voltage_aux_v / 1000, unit: 'кВ', max: 26, norm: '24–25', warn: 23.5, inverse: true } : null,
    loco.rpm ? { label: 'Обороты', value: loco.rpm, unit: 'об/мин', max: 2200, norm: 'до 1800', warn: 1700, inverse: false } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  const alertItems = [
    ...loco.alerts.map(alert => ({ type: alert.level === 'critical' ? 'al-crit' : 'al-warn', icon: alert.level === 'critical' ? '🚨' : '⚠️', title: alert.code ? `${alert.code} · ${alert.message}` : alert.message, recommendation: alert.recommend ?? loco.health_index.recommendation })),
    ...hazards.map(hazard => ({ type: 'al-warn', icon: '🚧', title: hazard.name, recommendation: `Снизить скорость до ${hazard.speedLimit} км/ч` })),
  ]

  return (
    <div className="st-wrap">
      <div className="sc anim" style={{ gridRow: '1 / 3' }}>
        <div className="sc-hdr">Индекс здоровья</div>
        <div className="sc-body">
          <div className="g-wrap"><GaugeCanvas score={loco.healthScore} color={scoreColor} /><div className="g-score"><div className="g-num" style={{ color: scoreColor }}>{loco.healthScore}</div></div></div>
          <div className="h-st" style={{ color: scoreColor }}>{loco.statusText}</div>
          <div className="h-ds">{loco.health_index.recommendation}</div>
          <div className="al-list">
            {alertItems.length === 0 ? (
              <div className="al al-ok"><div className="al-ic">✓</div><div className="al-b"><strong>Все системы в норме</strong></div></div>
            ) : (
              alertItems.map((item, index) => (
                <div key={`${item.title}-${index}`} className={`al ${item.type}`}>
                  <div className="al-ic">{item.icon}</div>
                  <div className="al-b"><strong>{item.title}</strong><div className="al-rec">→ {item.recommendation}</div></div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="sc anim d1">
        <div className="sc-hdr">Скорость / Нагрузка</div>
        <div className="sc-body">
          <div className="spd-main">{Math.round(loco.speed_kmh)}</div>
          <div className="spd-lim">лимит {loco.maxSpeed} км/ч</div>
          <div className="bar-rows">
            {speedBars.map(item => {
              const bad = item.inverse ? item.value < item.warn : item.value > item.warn
              return (
                <div key={item.label} className="br">
                  <span className="lb">{item.label}</span>
                  <div className="bar"><div className={`fill ${bad ? 'f-warn' : 'f-ok'}`} style={{ width: `${Math.min(100, (Math.abs(item.value) / item.max) * 100)}%` }} /></div>
                  <span className="vl">{item.value} {item.unit}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="sc anim d2">
        <div className="sc-hdr">Физика поезда</div>
        <div className="sc-body">
          <div>
            {[
              ['Масса локомотива', `${loco.locomotiveMass} т`],
              ['Груз вагонов', `${loco.cargo} т`],
              ['Масса пустых вагонов', `${loco.wagons * 22} т`],
              ['Полная масса', `${physics.totalMassTons} т`],
              ['Тяга / макс.', `${physics.tractionKn.toFixed(1)} / ${physics.maxTractionKn.toFixed(0)} кН`],
              ['Нагрузка двигателя', `${physics.loadPercent.toFixed(1)}%`],
              ...(physics.fuelPerKm != null ? [['Расход топлива', `${physics.fuelPerKm.toFixed(2)} л/км`]] : []),
            ].map(([label, value], index) => (
              <div key={`${label}-${index}`} className="phys-row"><span className="pk">{label}</span><span className="pv">{value}</span></div>
            ))}
          </div>
          <div className="phys-f">{`F=M*g*Cr + 0.5*rho*Cd*A*v²\n=${physics.totalMassTons}t*9.81*0.002 + 0.5*1.225*0.8*10*${(loco.speed_kmh / 3.6).toFixed(1)}²\n=${physics.rollingResistanceKn.toFixed(1)}kN + ${physics.aeroDragKn.toFixed(1)}kN = ${physics.tractionKn.toFixed(1)}kN\nLoad=${physics.tractionKn.toFixed(1)}/${physics.maxTractionKn.toFixed(0)}=${physics.loadPercent.toFixed(1)}%${physics.fuelPerKm != null ? `\nQ=${physics.fuelPerKm.toFixed(2)}L/km` : ''}`}</div>
        </div>
      </div>
      <div className="params-4 anim d2">
        {params.map(item => {
          const bad = item.inverse ? item.value < item.warn : item.value > item.warn
          return (
            <div key={item.label} className="pc">
              <div className="pc-l">{item.label}<span className={`sp ${bad ? 'sp-warn' : 'sp-ok'}`} style={{ fontSize: 9, padding: '1px 6px' }}>{bad ? '⚠' : '✓'}</span></div>
              <div className="pc-v">{item.value.toFixed(item.label === 'Обороты' ? 0 : 1)} <span className="pc-u">{item.unit}</span></div>
              <div className="pc-n">{item.norm}</div>
              <div className="pc-bar"><div className={`pc-fill ${bad ? 'f-warn' : 'f-ok'}`} style={{ width: `${Math.min(100, (item.value / item.max) * 100)}%` }} /></div>
            </div>
          )
        })}
      </div>
      <div className="trnd-2 anim d3">
        <div className="trnd"><div className="trnd-hd"><span className="tl">Скорость</span><span className="tv">{Math.round(loco.speed_kmh)} км/ч</span></div><SparklineCanvas data={loco.history.map(item => item.speed_kmh)} color="#0096A8" min={0} max={loco.maxSpeed} /></div>
        <div className="trnd"><div className="trnd-hd"><span className="tl">Двигатель</span><span className="tv">{loco.engine_temp_c.toFixed(1)}°C</span></div><SparklineCanvas data={loco.history.map(item => item.engine_temp_c)} color="#D97706" min={60} max={120} /></div>
        {loco.resourcePercent != null ? <div className="trnd"><div className="trnd-hd"><span className="tl">Топливо</span><span className="tv">{loco.resourcePercent.toFixed(1)}%</span></div><SparklineCanvas data={loco.history.map(item => item.resource_level)} color="#0EA572" min={0} max={100} /></div> : null}
        <div className="trnd"><div className="trnd-hd"><span className="tl">Давл. масла</span><span className="tv">{(loco.oil_pressure_bar ?? loco.pressure_bar).toFixed(1)} бар</span></div><SparklineCanvas data={loco.history.map(item => item.oil_pressure_bar ?? item.pressure_bar)} color="#2255B8" min={0} max={8} /></div>
      </div>
    </div>
  )
}

export default function App() {
  const { locos, summary } = useTelemetry()
  const displayLocos = useMemo(() => locos.map(createDisplayLoco), [locos])
  const [page, setPage] = useState<Page>('login')
  const [role, setRole] = useState<UserRole>('driver')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [driverTab, setDriverTab] = useState<DriverTab>('map')
  const [dispatcherTab, setDispatcherTab] = useState<DispatcherTab>('map')
  const [filter, setFilter] = useState<SelectFilter>('all')
  const [selectedType, setSelectedType] = useState<LocoType>('TE33A')
  const [aiOpen, setAiOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT)
  const [chatInput, setChatInput] = useState('')
  const [criticalToast, setCriticalToast] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState('operator')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(() => window.localStorage.getItem('ktj-token'))
  const [authUser, setAuthUser] = useState<{ username: string; role: string } | null>(null)
  const [backendOverview, setBackendOverview] = useState<BackendOverview>({ apiOnline: false, configCount: 0, alertsCount: 0, healthCount: 0, metricsReady: false })
  const [mapOverlayOpen, setMapOverlayOpen] = useState(false)
  const lastCriticalRef = useRef<string | null>(null)
  const loginParticles = useMemo(() => Array.from({ length: 18 }, (_, index) => ({
    id: index,
    left: `${(index * 91) % 100}%`,
    duration: `${12 + (index % 5) * 4}s`,
    delay: `${(index % 7) * 0.8}s`,
    opacity: 0.15 + (index % 4) * 0.08,
  })), [])

  useEffect(() => {
    if (!selectedId && displayLocos[0]) setSelectedId(displayLocos[0].locomotive_id)
    if (!detailId && displayLocos[0]) setDetailId(displayLocos[0].locomotive_id)
  }, [detailId, displayLocos, selectedId])

  useEffect(() => {
    const loadBackendOverview = async () => {
      const [healthResult, configResult, alertsResult, healthListResult, metricsResult] = await Promise.allSettled([
        healthcheck(),
        getConfig(),
        getAlerts(),
        getHealth(),
        fetchMetrics(),
      ])

      setBackendOverview({
        apiOnline: healthResult.status === 'fulfilled' && healthResult.value?.status === 'ok',
        configCount: configResult.status === 'fulfilled' && Array.isArray(configResult.value) ? configResult.value.length : 0,
        alertsCount: alertsResult.status === 'fulfilled' && Array.isArray(alertsResult.value) ? alertsResult.value.length : 0,
        healthCount: healthListResult.status === 'fulfilled' && Array.isArray(healthListResult.value) ? healthListResult.value.length : 0,
        metricsReady: metricsResult.status === 'fulfilled' && metricsResult.value.includes('app_http_requests_total'),
      })
    }

    void loadBackendOverview()
    const timer = window.setInterval(() => void loadBackendOverview(), 15000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!authToken) return

    void apiMe(authToken)
      .then(user => {
        setAuthUser({ username: user.username, role: user.role })
        setPage('landing')
      })
      .catch(() => {
        setAuthToken(null)
        setAuthUser(null)
        window.localStorage.removeItem('ktj-token')
      })
  }, [authToken])

  useEffect(() => {
    if (selectedId && !displayLocos.some(loco => loco.locomotive_id === selectedId)) setSelectedId(displayLocos[0]?.locomotive_id ?? null)
    if (detailId && !displayLocos.some(loco => loco.locomotive_id === detailId)) setDetailId(displayLocos[0]?.locomotive_id ?? null)
  }, [detailId, displayLocos, selectedId])

  useEffect(() => {
    const critical = displayLocos.find(loco => loco.status === 'critical')
    if (!critical || lastCriticalRef.current === critical.locomotive_id) return
    lastCriticalRef.current = critical.locomotive_id
    const text = critical.resourcePercent != null
      ? `${critical.locomotive_id}: health ${critical.healthScore}, топливо ${critical.resourcePercent.toFixed(1)}%, требуется немедленная проверка.`
      : `${critical.locomotive_id}: health ${critical.healthScore}, критическое состояние оборудования.`
    setCriticalToast(text)
    const timer = window.setTimeout(() => setCriticalToast(null), 30000)
    return () => window.clearTimeout(timer)
  }, [displayLocos])

  const selectedLoco = useMemo(() => displayLocos.find(loco => loco.locomotive_id === selectedId) ?? null, [displayLocos, selectedId])
  const detailLoco = useMemo(() => displayLocos.find(loco => loco.locomotive_id === detailId) ?? null, [detailId, displayLocos])
  const filteredLocos = useMemo(() => filter === 'all' ? displayLocos : displayLocos.filter(loco => loco.locomotive_type === filter), [displayLocos, filter])
  const activeCount = displayLocos.length

  const openSelect = () => {
    setRole('driver')
    setPage('select')
  }

  const openDispatcher = () => {
    setRole('dispatcher')
    setDispatcherTab('map')
    setPage('dispatcher')
  }

  const openDriver = (id: string) => {
    setSelectedId(id)
    setRole('driver')
    setDriverTab('map')
    setPage('driver')
  }

  const openDetail = (id: string) => {
    setDetailId(id)
    setRole('dispatcher')
    setPage('detail')
  }

  const sendAi = () => {
    const query = chatInput.trim()
    if (!query) return
    const answer = buildAiAnswer(query, displayLocos, selectedLoco ?? detailLoco ?? displayLocos[0] ?? null)
    setChatMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: query }, { id: `b-${Date.now() + 1}`, role: 'bot', text: answer }])
    setChatInput('')
  }

  const doLogin = async () => {
    try {
      const response = await apiLogin({ username: employeeId.trim(), password })
      window.localStorage.setItem('ktj-token', response.access_token)
      setAuthToken(response.access_token)
      setAuthUser({ username: response.username, role: response.role })
      setLoginError(null)
      setPage('landing')
    } catch {
      setLoginError('Неверный логин или пароль. Используйте admin/admin123, operator/operator123 или viewer/viewer123')
    }
  }

  const selectedDistance = selectedLoco ? (DISTANCES[selectedLoco.routeKey] ?? 300) * (1 - selectedLoco.progress) : 0
  const detailPhysics = detailLoco ? computePhysics(detailLoco) : null
  const detailWagons = detailLoco ? buildWagons(detailLoco) : []

  return (
    <div className="app-shell">
      <div id="pg-login" className={`pg ${page === 'login' ? 'on' : ''}`}>
        <div className="login-particles">
          {loginParticles.map(particle => <span key={particle.id} className="lp" style={{ left: particle.left, animationDuration: particle.duration, animationDelay: particle.delay, opacity: particle.opacity }} />)}
        </div>
        <div className="login-box">
          <div className="login-logo"><div className="login-logo-mark">КТЖ</div></div>
          <div className="login-divider" />
          <div className="login-title">Вход в систему КТЖ Loco Twin</div>
          <div className="login-sub">Авторизация идет через backend API. После входа фронт использует auth, history, alerts, health, config, metrics и live websocket.</div>
          <div className="login-field"><label className="login-label">Логин</label><input className="login-input" value={employeeId} placeholder="admin / operator / viewer" onChange={event => setEmployeeId(event.target.value)} /></div>
          <div className="login-field"><label className="login-label">Пароль</label><input className="login-input" type="password" value={password} placeholder="Введите пароль" onChange={event => setPassword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') doLogin() }} /></div>
          <button className="login-btn" onClick={doLogin}>Войти в систему</button>
          <div className={`login-error ${loginError ? 'on' : ''}`}>{loginError}</div>
          <div className="login-footer">Демо-учетки backend: <strong>admin/admin123</strong>, <strong>operator/operator123</strong>, <strong>viewer/viewer123</strong>.</div>
        </div>
        <div className="login-rail" />
      </div>

      <div id="pg-land" className={`pg ${page === 'landing' ? 'on' : ''}`}>
        <div className="land-top" />
        <div className="land-branding">
          <div className="land-logo-wrap">КТЖ</div>
          <div>
            <div className="land-name">КТЖ — LOCO TWIN</div>
            <div className="land-sub-name">Цифровой двойник локомотива</div>
          </div>
        </div>
        <div className="land-stats">
          <div className="land-stat-item"><div className="land-stat-n">{activeCount}</div><div className="land-stat-l">Активных</div></div>
          <div className="land-stat-item"><div className="land-stat-n">{summary.critical}</div><div className="land-stat-l" style={{ color: 'var(--rd)' }}>Критично</div></div>
          <div className="land-stat-item"><div className="land-stat-n">24/7</div><div className="land-stat-l">Мониторинг</div></div>
        </div>
        <div className="land-hero">
          <div className="land-logo-img-wrap anim"><div className="land-logo-hero">КТЖ</div></div>
          <div className="land-tag">КТЖ · Казахстан Темір Жолы</div>
          <div className="land-h1">Цифровой двойник<br /><span>локомотива</span></div>
          <div className="land-desc-land">Интерфейс повторяет HTML-макет и заполняется live-данными FastAPI backend и simulator.</div>
          <div className="backend-strip anim d1"><div className={`backend-pill ${backendOverview.apiOnline ? 'ok' : 'bad'}`}>API: {backendOverview.apiOnline ? 'online' : 'offline'}</div><div className="backend-pill">Config: {backendOverview.configCount}</div><div className="backend-pill">Alerts: {backendOverview.alertsCount}</div><div className="backend-pill">Health: {backendOverview.healthCount}</div><div className={`backend-pill ${backendOverview.metricsReady ? 'ok' : 'bad'}`}>Metrics</div>{authUser ? <div className="backend-pill">User: {authUser.username} ({authUser.role})</div> : null}</div>
          <div className="land-cards">
            <div className="land-card" onClick={openSelect}>
              <span className="land-card-icon">🚂</span>
              <div className="land-card-title">Машинист</div>
              <div className="land-card-sub">Маршрут, health index, параметры состава и рекомендации в реальном времени</div>
              <div className="land-card-btn">Войти →</div>
              <div className="land-feats" style={{ justifyContent: 'center', marginTop: 14 }}><div className="land-feat" style={{ fontSize: 10 }}>Карта</div><div className="land-feat" style={{ fontSize: 10 }}>Вагоны</div><div className="land-feat" style={{ fontSize: 10 }}>ИИ</div></div>
            </div>
            <div className="land-card" onClick={openDispatcher}>
              <span className="land-card-icon">📡</span>
              <div className="land-card-title">Диспетчер</div>
              <div className="land-card-sub">Парк на карте, alerts, детали каждого состава и критичные сценарии backend</div>
              <div className="land-card-btn">Открыть пульт →</div>
              <div className="land-feats" style={{ justifyContent: 'center', marginTop: 14 }}><div className="land-feat" style={{ fontSize: 10 }}>Парк</div><div className="land-feat" style={{ fontSize: 10 }}>Зоны</div><div className="land-feat" style={{ fontSize: 10 }}>ИИ</div></div>
            </div>
          </div>
        </div>
        <div className="land-rail" />
        <div className="land-sleepers" />
      </div>

      <div id="pg-sel" className={`pg ${page === 'select' ? 'on' : ''}`}>
        <div className="tb anim">
          <TopLogo title="LOCO TWIN" />
          <div className="tb-sep" />
          <span className="tb-txt">Режим машиниста</span>
          <div className="tb-r"><button className="btn" onClick={() => setPage('landing')}>← Главная</button></div>
        </div>
        <div className="sel-hdr anim d1"><div className="sel-crumb">КТЖ / Машинист / Выбор локомотива</div><div className="sel-title">Выберите ваш локомотив</div></div>
        <div className="sel-body">
          <div className="type-grid anim d2">
            {(['TE33A', 'KZ8A'] as LocoType[]).map(type => (
              <div key={type} className={`tc ${selectedType === type ? 'sel' : ''}`} onClick={() => { setSelectedType(type); setFilter(type) }}>
                <div className="tc-icon" style={type === 'KZ8A' ? { background: '#EEF4FF' } : undefined}>{type === 'KZ8A' ? '⚡' : '🚂'}</div>
                <div>
                  <div className="tc-name">{type === 'TE33A' ? 'ТЕ33А' : 'KZ8A'}</div>
                  <div className="tc-sub">{type === 'TE33A' ? 'Тепловоз · Дизельная тяга' : 'Электровоз · 25 кВ AC'}</div>
                  <div className="tc-tags">{type === 'TE33A' ? <><div className="stag">3 310 кВт</div><div className="stag">до 120 км/ч</div><div className="stag">138 т</div><div className="stag">8 000 л топлива</div></> : <><div className="stag">8 000 кВт</div><div className="stag">до 200 км/ч</div><div className="stag">200 т</div><div className="stag">25 кВ AC</div></>}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="fbar anim d2">
            <button className={`ftg ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>Все</button>
            <button className={`ftg ${filter === 'TE33A' ? 'on' : ''}`} onClick={() => { setSelectedType('TE33A'); setFilter('TE33A') }}>ТЕ33А</button>
            <button className={`ftg ${filter === 'KZ8A' ? 'on' : ''}`} onClick={() => { setSelectedType('KZ8A'); setFilter('KZ8A') }}>KZ8A</button>
          </div>
          <div className="loco-list anim d3">
            {filteredLocos.map(loco => (
              <div key={loco.locomotive_id} className={`lc ${loco.status === 'critical' ? 'lc-crit' : loco.status === 'warning' ? 'lc-warn' : ''}`} onClick={() => openDriver(loco.locomotive_id)}>
                <div className={`lc-av ${loco.avatarClass}`}>{loco.icon}</div>
                <div className="lc-meta">
                  <div className="lc-row1"><span className="lc-nm">{loco.locomotive_id}</span><span className={`tbadge ${loco.locomotive_type === 'KZ8A' ? 'bkz' : 'bte'}`}>{loco.locomotive_type}</span><span className={`sp ${loco.badgeClass}`}>{loco.statusText}</span></div>
                  <div className="lc-route">{loco.routeLabel}</div>
                  <div className="lc-row2"><div><div className="mv">{Math.round(loco.speed_kmh)} км/ч</div><div className="ml">Скорость</div></div><div><div className="mv">{loco.wagons}</div><div className="ml">Вагонов</div></div><div><div className="mv">{loco.healthScore}</div><div className="ml">Health</div></div></div>
                </div>
                <div className="lc-arr">›</div>
              </div>
            ))}
            {filteredLocos.length === 0 ? <div className="empty-note">Ожидание телеметрии от backend…</div> : null}
          </div>
        </div>
      </div>

      <div id="pg-drv" className={`pg ${page === 'driver' ? 'on' : ''}`}>
        <div className="tb">
          <TopLogo />
          <div className="tb-sep" />
          <div className={`tb-dot ${selectedLoco?.status === 'critical' ? 'tcrit' : selectedLoco?.status === 'warning' ? 'twarn' : 'tok'}`} />
          <div className="tb-id">{selectedLoco?.locomotive_id ?? '—'}</div>
          <span className={`tbadge ${selectedLoco?.locomotive_type === 'KZ8A' ? 'bkz' : 'bte'}`}>{selectedLoco?.locomotive_type ?? '—'}</span>
          <div className="tb-sep" />
          <span className="tb-txt mono">{selectedLoco?.routeLabel ?? '—'}</span>
          <div className="tb-r"><button className="btn" onClick={() => setPage('select')}>Сменить</button><button className="btn" onClick={() => setPage('landing')}>← Главная</button></div>
        </div>
        <div className="tabs"><div className={`tab ${driverTab === 'map' ? 'on' : ''}`} onClick={() => setDriverTab('map')}>🗺 Маршрут и карта</div><div className={`tab ${driverTab === 'status' ? 'on' : ''}`} onClick={() => setDriverTab('status')}>📊 Состояние локомотива</div></div>
        <div className="drv-body">
          {driverTab === 'map' ? (
            <div className="tab-panel on">
              <div className="map-wrap">
                <MapSvg locos={displayLocos} mode="driver" selectedId={selectedLoco?.locomotive_id} />
                <div className="map-hud">
                  <div className="hc"><div className="hl">📍 Следующая остановка</div><div className="hv">{selectedLoco?.to ?? '—'}</div><div className="hs">{selectedLoco ? `через ${Math.round((selectedDistance / Math.max(selectedLoco.speed_kmh, 1)) * 60)} мин` : '—'}</div><div className="rprog"><div className="rfill" style={{ width: `${(selectedLoco?.progress ?? 0) * 100}%` }} /></div></div>
                  <div className="hc"><div className="hl">📡 Позиция</div><div className="hv mono">{selectedLoco ? `${selectedLoco.lat.toFixed(3)}°N` : '—'}</div><div className="hs">{selectedLoco ? `${selectedLoco.lon.toFixed(3)}°E` : '—'}</div></div>
                  <div className="hc"><div className="hl">🏁 До конца маршрута</div><div className="hv">{selectedLoco ? Math.round(selectedDistance) : '—'} <span className="hu">км</span></div><div className="hs">{selectedLoco ? formatEta(selectedDistance / Math.max(selectedLoco.speed_kmh, 1)) : '—'}</div></div>
                  <div className="hc"><div className="hl">⚡ Скорость</div><div className="hv">{selectedLoco ? Math.round(selectedLoco.speed_kmh) : '—'} <span className="hu">км/ч</span></div><div className="hs">лимит {selectedLoco?.maxSpeed ?? '—'} км/ч</div></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="tab-panel on">{selectedLoco ? <DriverStatusView loco={selectedLoco} /> : <div className="empty-note">Ожидание телеметрии от backend…</div>}</div>
          )}
        </div>
      </div>

      <div id="pg-dis" className={`pg ${page === 'dispatcher' ? 'on' : ''}`}>
        <div className="tb"><TopLogo title="ДИСПЕТЧЕРСКИЙ ПУЛЬТ" /><div className="tb-sep" /><span className="tb-txt">Мониторинг парка в реальном времени</span><div className="tb-r"><button className="btn btnp" onClick={() => setPage('landing')}>← Главная</button></div></div>
        <div className="tabs"><div className={`tab ${dispatcherTab === 'map' ? 'on' : ''}`} onClick={() => setDispatcherTab('map')}>🗺 Карта парка <span className="tcnt">{summary.normal}</span></div><div className={`tab ${dispatcherTab === 'fleet' ? 'on' : ''}`} onClick={() => setDispatcherTab('fleet')}>📋 Список локомотивов <span className="tcnt">{displayLocos.length}</span></div></div>
        <div className="dis-body">
          {dispatcherTab === 'map' ? (
            <div className="dis-tp on">
              <div className="dis-map-wrap"><MapSvg locos={displayLocos} mode="dispatch" onSelect={openDetail} /></div>
              <div className="dis-sidebar">
                <div className="ds-stats">
                  <div className="ds-s"><div className="ds-n">{displayLocos.length}</div><div className="ds-l">Всего</div></div>
                  <div className="ds-s"><div className="ds-n ok">{summary.normal}</div><div className="ds-l">Норма</div></div>
                  <div className="ds-s"><div className="ds-n warn">{summary.warning}</div><div className="ds-l">Внимание</div></div>
                  <div className="ds-s"><div className="ds-n crit">{summary.critical}</div><div className="ds-l">Крит.</div></div>
                </div>
                <div className="fl-scroll">
                  {displayLocos.map(loco => {
                    const physics = computePhysics(loco)
                    return (
                      <div key={loco.locomotive_id} className={`fr ${detailId === loco.locomotive_id ? 'sel' : ''} ${loco.status === 'critical' ? 'fr-crit' : loco.status === 'warning' ? 'fr-warn' : ''}`} onClick={() => openDetail(loco.locomotive_id)}>
                        <div className="fh" style={{ color: loco.color, borderColor: loco.color, background: `${loco.color}18` }}>{loco.healthScore}</div>
                        <div className="fi"><div className="fi-id">{loco.locomotive_id}</div><div className="fi-sub">{loco.routeLabel}</div><div className="fi-sub">{loco.wagons} ваг · {loco.cargo} т · {physics.loadPercent.toFixed(1)}%</div></div>
                        <div className="fspd">{Math.round(loco.speed_kmh)} км/ч</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="dis-tp on">
              <div className="fleet-tab-content">
                <div className="fleet-section-title">Активный парк КТЖ — {displayLocos.length} локомотивов</div>
                <div className="fleet-cards">
                  {displayLocos.map(loco => {
                    const physics = computePhysics(loco)
                    return (
                      <div key={loco.locomotive_id} className={`fleet-card ${loco.status === 'critical' ? 'fc-crit' : loco.status === 'warning' ? 'fc-warn' : ''}`} onClick={() => openDetail(loco.locomotive_id)}>
                        <div className="fc-health" style={{ color: loco.color, borderColor: loco.color, background: `${loco.color}15` }}>{loco.healthScore}</div>
                        <div className="fc-main"><div className="fc-r1"><span className="fc-id">{loco.locomotive_id}</span><span className={`sp ${loco.badgeClass}`}>{loco.statusText}</span></div><div className="fc-route">{loco.routeLabel} · {loco.driver}</div><div className="fc-metrics"><div className="fcm"><div className="fcm-v">{Math.round(loco.speed_kmh)}</div><div className="fcm-l">Скорость</div></div><div className="fcm"><div className="fcm-v">{loco.wagons}</div><div className="fcm-l">Вагонов</div></div><div className="fcm"><div className="fcm-v">{loco.cargo}</div><div className="fcm-l">Груз</div></div><div className="fcm"><div className="fcm-v">{physics.loadPercent.toFixed(1)}%</div><div className="fcm-l">Нагрузка</div></div></div></div>
                        <div className="fc-right"><div className="fc-arr">›</div></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div id="pg-detail" className={`pg ${page === 'detail' ? 'on' : ''}`}>
        <div className="tb"><TopLogo /><div className="tb-sep" /><div className={`tb-dot ${detailLoco?.status === 'critical' ? 'tcrit' : detailLoco?.status === 'warning' ? 'twarn' : 'tok'}`} /><div className="tb-id">{detailLoco?.locomotive_id ?? '—'}</div><span className={`tbadge ${detailLoco?.locomotive_type === 'KZ8A' ? 'bkz' : 'bte'}`}>{detailLoco?.locomotive_type ?? '—'}</span><div className="tb-r"><button className="btn" onClick={() => detailLoco && window.open(`${getCsvReportUrl()}?locomotive_id=${encodeURIComponent(detailLoco.locomotive_id)}`, '_blank')}>CSV</button><button className="btn" onClick={() => detailLoco && window.open(getPdfReportUrl({ locomotive_id: detailLoco.locomotive_id }), '_blank')}>PDF</button><button className="btn" onClick={() => setMapOverlayOpen(true)}>🗺 Карта</button><button className="btn" onClick={() => setAiOpen(true)}>🤖 ИИ</button><button className="btn" onClick={() => { setPage('dispatcher'); setDispatcherTab('fleet') }}>← Список</button><button className="btn" onClick={() => setPage('landing')}>Главная</button></div></div>
        <div className="detail-hdr"><div className="detail-title"><h1>{detailLoco ? `${detailLoco.locomotive_id} · ${detailLoco.locomotive_type}` : '—'}</h1><p>{detailLoco ? `${detailLoco.routeLabel} · Машинист: ${detailLoco.driver} · ${detailLoco.cargoType}` : '—'}</p></div>{detailLoco ? <span className={`sp ${detailLoco.badgeClass}`} style={{ fontSize: 13, padding: '6px 14px' }}>{detailLoco.statusText}</span> : null}</div>
        <div id="det-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {detailLoco && detailPhysics ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="detail-section"><div className="ds-head">Движение</div><div className="ds-row"><span className="ds-k">Скорость</span><span className="ds-v">{Math.round(detailLoco.speed_kmh)} / {detailLoco.maxSpeed} км/ч</span></div><div className="ds-row"><span className="ds-k">Прогресс</span><span className="ds-v">{(detailLoco.progress * 100).toFixed(0)}%</span></div><div className="ds-row"><span className="ds-k">Нагрузка</span><span className="ds-v">{detailPhysics.loadPercent.toFixed(1)}%</span></div></div>
                <div className="detail-section"><div className="ds-head">Тех. состояние</div><div className="ds-row"><span className="ds-k">Масло</span><span className="ds-v">{detailLoco.oil_temp_c.toFixed(1)}°C</span></div><div className="ds-row"><span className="ds-k">Давл. масла</span><span className="ds-v">{(detailLoco.oil_pressure_bar ?? detailLoco.pressure_bar).toFixed(1)} бар</span></div><div className="ds-row"><span className="ds-k">Тормозное</span><span className="ds-v">{(detailLoco.brake_pressure_bar ?? detailLoco.pressure_bar).toFixed(1)} бар</span></div></div>
                <div className="detail-section"><div className="ds-head">Ресурс</div>{detailLoco.resourcePercent != null ? <div className="ds-row"><span className="ds-k">Остаток</span><span className="ds-v">{detailLoco.resourcePercent.toFixed(1)}%</span></div> : null}<div className="ds-row"><span className="ds-k">Полная масса</span><span className="ds-v">{detailPhysics.totalMassTons} т</span></div><div className="ds-row"><span className="ds-k">Расход</span><span className="ds-v">{detailPhysics.fuelPerKm != null ? `${detailPhysics.fuelPerKm.toFixed(2)} л/км` : '—'}</span></div><div className="ds-row"><span className="ds-k">Расход/час</span><span className="ds-v">{detailPhysics.fuelPerHour != null ? `${detailPhysics.fuelPerHour.toFixed(1)} л/ч` : '—'}</span></div><div className="ds-row"><span className="ds-k">Запас хода</span><span className="ds-v">{detailPhysics.estimatedRangeKm != null ? `${Math.round(detailPhysics.estimatedRangeKm)} км` : '—'}</span></div></div>
              </div>
              <div className="wagon-vis">
                <div className="ds-head" style={{ padding: '0 0 12px' }}>🚃 Состав: {detailLoco.wagons} вагонов · Груз: {detailLoco.cargo} т</div>
                <div className="wagon-track">
                  <div className="wagon-loco"><div className="wagon-loco-body">{detailLoco.locomotive_type === 'KZ8A' ? '⚡ KZ8A' : '🚂 ТЕ33А'}</div><div style={{ display: 'flex', gap: 10 }}><div className="ww" /><div className="ww" /><div className="ww" /><div className="ww" /></div><div className="wagon-num" style={{ fontWeight: 700, color: 'var(--t)' }}>ЛОК</div></div>
                  {detailWagons.map(wagon => (
                    <Fragment key={wagon.number}>
                      <div className="wagon-coupler" />
                      <div className="wagon-car"><div className={`wagon-body ${wagon.state}`}>{wagon.load}т</div><div style={{ display: 'flex', gap: 6 }}><div className="ww" /><div className="ww" /></div><div className="wagon-num">#{wagon.number}</div></div>
                    </Fragment>
                  ))}
                </div>
                <div className="wagon-rail" />
              </div>
            </>
          ) : <div className="empty-note">Ожидание данных…</div>}
        </div>
      </div>

      <div id="map-overlay" className={mapOverlayOpen ? 'on' : ''}>
        <div className="mo-bar"><div className="mo-title">Карта локомотива {detailLoco?.locomotive_id ?? ''}</div><button className="mo-close" onClick={() => setMapOverlayOpen(false)}>Закрыть</button></div>
        <div className="mo-map"><MapSvg locos={displayLocos} mode="driver" selectedId={detailLoco?.locomotive_id} /></div>
      </div>

      <div id="ai-panel" className={aiOpen ? 'on' : ''}><div className="ai-header"><div className="ai-logo">🤖</div><div className="ai-title">КТЖ ИИ-Ассистент</div><button className="ai-close" onClick={() => setAiOpen(false)}>✕ Закрыть</button></div><div className="ai-msgs">{chatMessages.map(message => <div key={message.id} className={`ai-msg ${message.role}`}>{message.text}</div>)}</div><div className="ai-suggest">{CHAT_SUGGESTIONS.map(suggestion => <div key={suggestion} className="ai-sug" onClick={() => setChatInput(suggestion)}>{suggestion}</div>)}</div><div className="ai-input-wrap"><textarea className="ai-input" value={chatInput} placeholder="Спросите о любом локомотиве..." onChange={event => setChatInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendAi() } }} /><button className="ai-send" onClick={sendAi}>→</button></div></div>
      <button id="ai-btn" className={page === 'driver' || page === 'dispatcher' || page === 'detail' ? 'show' : ''} onClick={() => setAiOpen(prev => !prev)} title="КТЖ ИИ-Ассистент">🤖</button>
      <div id="crit-al" className={criticalToast ? 'on' : ''}><div className="ca-t">🚨 Критическая тревога</div><div className="ca-b">{criticalToast}</div><button className="ca-btn" onClick={() => setCriticalToast(null)}>Принято</button></div>
      <div className="hidden-role" data-role={role} />
    </div>
  )
}
