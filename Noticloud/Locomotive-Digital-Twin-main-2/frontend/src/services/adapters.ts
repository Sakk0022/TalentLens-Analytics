import type { BackendTelemetry, LocomotiveState, AlertItem, HealthIndex, HealthStatus, ResourceType } from '@/types'

function normalizeAlerts(raw: unknown[] | undefined, timestamp: string): AlertItem[] {
    if (!raw || !Array.isArray(raw)) return []

    return raw.map((item, index) => {
        if (typeof item === 'string') {
            const level = item.toUpperCase().includes('CRIT') ? 'critical' : 'warning'
            return {
                id: `${item}-${index}`,
                level,
                severity: level,
                message: item,
                timestamp,
            }
        }

        if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>
            const severity = normalizeAlertSeverity(obj.severity)
            return {
                id: String(obj.id ?? obj.code ?? `alert-${index}`),
                code: obj.code ? String(obj.code) : undefined,
                level: severity === 'critical' ? 'critical' : 'warning',
                severity,
                message: String(obj.message ?? obj.msg ?? obj.code ?? 'Unknown alert'),
                timestamp: String(obj.timestamp ?? timestamp),
                recommend: obj.recommend ? String(obj.recommend) : null,
            }
        }

        return {
            id: `alert-${index}`,
            level: 'warning',
            severity: 'warning',
            message: String(item),
            timestamp,
        }
    })
}

function normalizeAlertSeverity(raw: unknown): 'info' | 'warning' | 'critical' {
    const value = String(raw ?? 'warning').toLowerCase()
    if (value === 'critical') return 'critical'
    if (value === 'info') return 'info'
    return 'warning'
}

function normalizeHealthStatus(raw: unknown): HealthStatus {
    const value = String(raw ?? 'normal').toLowerCase()
    if (value === 'critical') return 'critical'
    if (value === 'warning') return 'warning'
    if (value === 'norm') return 'normal'
    return 'normal'
}

function normalizeHealth(raw: BackendTelemetry['health_index']): HealthIndex {
    return {
        score: raw?.score ?? 100,
        status: normalizeHealthStatus(raw?.status ?? raw?.health_status),
        factors: (raw?.factors ?? []).map((factor, index) => ({
            name: factor.name ?? factor.label ?? `factor-${index}`,
            penalty: factor.penalty,
        })),
        recommendation: raw?.recommendation ?? 'Нет данных от backend',
    }
}

function inferResourceType(raw: BackendTelemetry): ResourceType {
    if (raw.resource_type) return raw.resource_type
    return raw.locomotive_type === 'KZ8A' ? 'energy' : 'fuel'
}

export function normalizeTelemetry(raw: BackendTelemetry): LocomotiveState {
    const resourceLevel = raw.resource_level
        ?? raw.fuel_percent
        ?? (raw.locomotive_type === 'KZ8A' ? 100 : 0)
    const pressure = raw.pressure_bar
        ?? raw.oil_pressure_bar
        ?? raw.brake_pressure_bar
        ?? 0

    return {
        ...raw,
        scenario: raw.scenario ?? null,
        step: raw.step ?? null,
        resource_level: resourceLevel,
        resource_type: inferResourceType(raw),
        fuel_percent: raw.fuel_percent ?? resourceLevel,
        fuel_liters: raw.fuel_liters ?? null,
        rpm: raw.rpm ?? null,
        engine_temp_c: raw.engine_temp_c ?? 0,
        exhaust_temp_c: raw.exhaust_temp_c ?? null,
        oil_temp_c: raw.oil_temp_c ?? 0,
        pressure_bar: pressure,
        oil_pressure_bar: raw.oil_pressure_bar ?? raw.pressure_bar ?? null,
        brake_pressure_bar: raw.brake_pressure_bar ?? null,
        compressor_bar: raw.compressor_bar ?? null,
        voltage_aux_v: raw.voltage_aux_v ?? null,
        alerts: normalizeAlerts(raw.alerts, raw.timestamp),
        health_index: normalizeHealth(raw.health_index),
        history: [],
    }
}