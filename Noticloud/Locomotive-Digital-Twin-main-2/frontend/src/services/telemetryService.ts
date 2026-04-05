import type { BackendTelemetry, LocomotiveState } from '@/types'
import { normalizeTelemetry } from './adapters'
import { tickAll } from '@/mock/simulator'
import { getHistory } from './api'

const DATA_MODE = import.meta.env.VITE_DATA_MODE ?? 'live'
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://127.0.0.1:8000/ws/live'

type Listener = (payloads: LocomotiveState[]) => void

class TelemetryService {
  private listeners = new Set<Listener>()
  private ws: WebSocket | null = null
  private timer: number | null = null
  private shouldReconnect = false
  private stopTimeout: number | null = null
  private stopDebounceMs = 500 // Debounce stop() to protect from React StrictMode
  private bootstrapPromise: Promise<void> | null = null

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    console.log(`[TelemetryService] Subscriber added. Total: ${this.listeners.size}`)

    if (this.listeners.size === 1) {
      // Cancel any pending stop operation
      if (this.stopTimeout !== null) {
        clearTimeout(this.stopTimeout)
        this.stopTimeout = null
        console.log('[TelemetryService] Cancelled pending stop')
      }

      void this.bootstrapFromHistory()

      if (DATA_MODE === 'mock') {
        this.startMock()
      } else {
        this.connectWs()
      }
    }

    return () => {
      this.listeners.delete(fn)
      console.log(`[TelemetryService] Subscriber removed. Total: ${this.listeners.size}`)

      if (this.listeners.size === 0) {
        // Debounce stop to protect from React StrictMode double-unmount
        if (this.stopTimeout !== null) {
          clearTimeout(this.stopTimeout)
        }
        this.stopTimeout = window.setTimeout(() => {
          console.log('[TelemetryService] No subscribers left, stopping...')
          this.stop()
        }, this.stopDebounceMs)
      }
    }
  }

  private emit(payloads: LocomotiveState[]) {
    this.listeners.forEach(fn => fn(payloads))
  }

  private async bootstrapFromHistory() {
    if (this.bootstrapPromise) {
      await this.bootstrapPromise
      return
    }

    this.bootstrapPromise = (async () => {
      if (DATA_MODE === 'mock') return

      try {
        const raw = await getHistory({ limit: 240, order: 'asc' })
        if (!Array.isArray(raw) || raw.length === 0) return

        const normalized = (raw as BackendTelemetry[]).map(normalizeTelemetry)
        this.emit(normalized)
      } catch (error) {
        console.warn('[TelemetryService] Failed to bootstrap history', error)
      }
    })()

    await this.bootstrapPromise
  }

  private startMock() {
    // Clear any existing resources first
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.timer = window.setInterval(() => {
      const raw: BackendTelemetry[] = tickAll()
      const normalized = raw.map(normalizeTelemetry)
      this.emit(normalized)
    }, 1000)
  }

  private connectWs() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.shouldReconnect = true
    console.log(`[TelemetryService] Connecting to ${WS_URL}`)
    this.ws = new WebSocket(WS_URL)

    this.ws.onopen = () => {
      console.log('[TelemetryService] WebSocket connected successfully')

      const pingInterval = window.setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }))
        } else {
          clearInterval(pingInterval)
        }
      }, 45000)
    }

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        
        // Ignore control messages
        if (data.type === 'connection_status' || data.type === 'pong') {
          console.log('[TelemetryService] Received:', data.type)
          return
        }
        
        // Handle telemetry_update messages from backend: structure is
        // { type: 'telemetry_update', data: { telemetry: {...}, health: {...}, alerts: [...] } }
        let rawList: BackendTelemetry[] = []
        if (data.type === 'telemetry_update' && data.data) {
          const t = data.data.telemetry ?? {}
          const h = data.data.health ?? {}
          const a = data.data.alerts ?? t.alerts ?? []
          const merged: BackendTelemetry = {
            ...t,
            health_index: {
              ...(h.health_index ?? {}),
              status: h.health_status ?? h.status ?? h.health_index?.status,
              recommendation: h.recommendation ?? h.health_index?.recommendation,
              factors: h.factors ?? h.health_index?.factors,
            },
            alerts: a,
          }
          rawList = [merged]
        } else if (Array.isArray(data)) {
          rawList = data
        } else if (data && typeof data === 'object') {
          rawList = [data]
        }

        const normalized = rawList.map(normalizeTelemetry)
        this.emit(normalized)
      } catch (err) {
        console.error('[TelemetryService] WS parse error', err)
      }
    }

    this.ws.onclose = (event) => {
      console.log('[TelemetryService] WebSocket closed', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      })
      if (this.shouldReconnect && this.listeners.size > 0) {
        console.log('[TelemetryService] Reconnecting in 3 seconds...')
        window.setTimeout(() => this.connectWs(), 3000)
      }
    }

    this.ws.onerror = (event) => {
      console.error('[TelemetryService] WS connection error', event)
    }
  }

  private stop() {
    console.log('[TelemetryService] Stopping service')
    this.shouldReconnect = false

    if (this.stopTimeout !== null) {
      clearTimeout(this.stopTimeout)
      this.stopTimeout = null
    }

    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.bootstrapPromise = null
  }
}

export const telemetryService = new TelemetryService()