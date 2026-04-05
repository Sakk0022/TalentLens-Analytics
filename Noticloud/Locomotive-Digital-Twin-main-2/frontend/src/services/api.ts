export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY ?? 'supersecret123'

export async function healthcheck() {
    const res = await fetch(`${API_BASE}/health`)
    if (!res.ok) throw new Error('Healthcheck failed')
    return res.json()
}

export async function getHistory(query?: Record<string, unknown>) {
    const url = new URL(`${API_BASE}/api/history`)
    if (query) {
        Object.entries(query).forEach(([k, v]) => {
            if (v !== undefined && v !== null) url.searchParams.append(k, String(v))
        })
    }

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error('Failed to load history')
    return res.json()
}

export async function getAlerts() {
    const res = await fetch(`${API_BASE}/api/alerts`)
    if (!res.ok) throw new Error('Failed to load alerts')
    return res.json()
}

export async function getHealth() {
    const res = await fetch(`${API_BASE}/api/health`)
    if (!res.ok) throw new Error('Failed to load health')
    return res.json()
}

export async function getConfig() {
    const res = await fetch(`${API_BASE}/api/config`)
    if (!res.ok) throw new Error('Failed to load config')
    return res.json()
}

export async function updateConfigParameter(
    locomotiveType: string,
    parameter: string,
    config: {
        warning_min?: number | null
        warning_max?: number | null
        critical_min?: number | null
        critical_max?: number | null
        weight?: number
    }
) {
    const res = await fetch(
        `${API_BASE}/api/config/${locomotiveType}/${parameter}`,
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': ADMIN_API_KEY,
            },
            body: JSON.stringify(config),
        }
    )
    if (!res.ok) throw new Error('Failed to update config')
    return res.json()
}

export async function ingestTelemetry(payload: {
    locomotive_id: string
    locomotive_type: string
    timestamp: string
    speed_kmh: number
    resource_level: number
    resource_type: string
    engine_temp_c: number
    oil_temp_c: number
    pressure_bar: number
    alerts: string[]
    lat: number
    lon: number
}) {
    const res = await fetch(`${API_BASE}/api/telemetry/ingest`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to ingest telemetry')
    return res.json()
}

export function getCsvReportUrl() {
    return `${API_BASE}/api/report/csv`
}

export function getPdfReportUrl(params?: Record<string, unknown>) {
    const url = new URL(`${API_BASE}/api/report/pdf`)
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null) url.searchParams.append(k, String(v))
        })
    }
    return url.toString()
}

export async function fetchMetrics() {
    const res = await fetch(`${API_BASE}/metrics`)
    if (!res.ok) throw new Error('Failed to load metrics')
    return res.text()
}

export async function login(payload: { username: string; password: string }) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Login failed')
    return res.json()
}

export async function me(token?: string) {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers })
    if (!res.ok) throw new Error('Failed to fetch user info')
    return res.json()
}

export async function adminCheck(token?: string) {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${API_BASE}/api/auth/admin-check`, { headers })
    if (!res.ok) throw new Error('Admin check failed')
    return res.json()
}

export async function getHistoryEvents(query?: Record<string, unknown>) {
    const url = new URL(`${API_BASE}/api/history/events`)
    if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.append(k, String(v)))
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error('Failed to load history events')
    return res.json()
}

export async function replayHistory(query?: Record<string, unknown>) {
    const url = new URL(`${API_BASE}/api/history/replay`)
    if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.append(k, String(v)))
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error('Failed to load replay history')
    return res.json()
}