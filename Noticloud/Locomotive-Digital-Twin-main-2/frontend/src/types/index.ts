export type LocoType = 'KZ8A' | 'TE33A'
export type ResourceType = 'fuel' | 'energy'
export type HealthStatus = 'normal' | 'warning' | 'critical'
export type UserRole = 'driver' | 'dispatcher'

export interface FleetSummary {
  total: number
  normal: number
  warning: number
  critical: number
}

export type Alert = AlertItem
export type TelemetryPayload = LocomotiveState

export interface BackendTelemetry {
  id?: number
  locomotive_id: string
  locomotive_type: LocoType
  timestamp: string
  scenario?: string | null
  step?: number | null
  speed_kmh: number
  resource_level?: number | null
  fuel_percent?: number | null
  fuel_liters?: number | null
  resource_type?: ResourceType
  rpm?: number | null
  engine_temp_c?: number | null
  exhaust_temp_c?: number | null
  oil_temp_c?: number | null
  pressure_bar?: number | null
  oil_pressure_bar?: number | null
  brake_pressure_bar?: number | null
  compressor_bar?: number | null
  voltage_aux_v?: number | null
  alerts?: unknown[]
  lat: number
  lon: number
  health_index?: BackendHealthIndex
}

export interface BackendHealthIndex {
  score: number
  status?: HealthStatus | 'NORM' | 'WARNING' | 'CRITICAL'
  health_status?: HealthStatus | 'NORM' | 'WARNING' | 'CRITICAL'
  factors?: { name?: string; label?: string; penalty: number }[]
  recommendation?: string
}

export interface AlertItem {
  id: string
  level: 'warning' | 'critical'
  severity?: 'info' | 'warning' | 'critical'
  message: string
  timestamp: string
  code?: string
  recommend?: string | null
}

export interface HealthIndex {
  score: number
  status: HealthStatus
  factors: { name: string; penalty: number }[]
  recommendation: string
}

export interface LocomotiveState {
  locomotive_id: string
  locomotive_type: LocoType
  timestamp: string
  scenario?: string | null
  step?: number | null
  route?: string
  speed_kmh: number
  resource_level: number
  resource_type: ResourceType
  engine_temp_c: number
  exhaust_temp_c?: number | null
  oil_temp_c: number
  pressure_bar: number
  fuel_percent?: number | null
  fuel_liters?: number | null
  rpm?: number | null
  oil_pressure_bar?: number | null
  brake_pressure_bar?: number | null
  compressor_bar?: number | null
  voltage_aux_v?: number | null
  alerts: AlertItem[]
  lat: number
  lon: number
  health_index: HealthIndex
  history: {
    timestamp: string
    speed_kmh: number
    engine_temp_c: number
    oil_temp_c: number
    pressure_bar: number
    resource_level: number
    oil_pressure_bar?: number | null
    brake_pressure_bar?: number | null
  }[]
}

export interface ConfigParameter {
  id: number
  locomotive_type: LocoType
  parameter: string
  label: string
  unit: string
  direction: string
  norm_min: number | null
  norm_max: number | null
  warning_min: number | null
  warning_max: number | null
  critical_min: number | null
  critical_max: number | null
  penalty_warn: number
  penalty_crit: number
  alert_code: string
  alert_msg: string
  recommend_warn: string
  recommend_crit: string
  weight: number
}