// src/components/shared/LocoMap.tsx
// Uses Leaflet + OpenStreetMap tiles — real Kazakhstan rail infrastructure is visible.
// Mock routes follow actual rail corridors, so they look real on the map.
// When backend is ready: just replace useTelemetry data source — map code stays identical.

import { useEffect, useRef } from 'react'
import type { LocomotiveState } from '@/types'
import { ROUTES } from '@/mock/simulator'

export const LOCO_COLORS: Record<string, string> = {
  'LOCO-001': '#22c55e',
  'LOCO-002': '#eab308',
  'LOCO-003': '#3b82f6',
  'LOCO-004': '#a78bfa',
}

interface Props {
  locos: LocomotiveState[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  singleId?: string
}

export function LocoMap({ locos, selectedId, onSelect, singleId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeLinesRef = useRef<Map<string, any>>(new Map())

  // Init map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    // Dynamic import so Vite doesn't SSR-break
    import('leaflet').then(L => {
      if (!containerRef.current || mapRef.current) return

      // Light tile layer to match the white-blue dashboard theme
      const map = L.map(containerRef.current, {
        center: [48.5, 68.0], // Centre of Kazakhstan
        zoom: 5,
        zoomControl: true,
      })

      L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }
      ).addTo(map)

      mapRef.current = map

      // Draw route polylines
      const visibleIds = singleId ? [singleId] : Object.keys(ROUTES)
      visibleIds.forEach(id => {
        const route = ROUTES[id]
        if (!route) return
        const color = LOCO_COLORS[id] ?? '#888'
        const line = L.polyline(route as [number, number][], {
          color,
          weight: 2.5,
          opacity: 0.55,
          dashArray: '8 6',
        }).addTo(map)
        routeLinesRef.current.set(id, line)
      })
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersRef.current.clear()
        routeLinesRef.current.clear()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleId])

  // Update markers on loco data change
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(L => {
      if (!mapRef.current) return

      const visibleLocos = singleId ? locos.filter(l => l.locomotive_id === singleId) : locos

      visibleLocos.forEach(loco => {
        if (!loco.lat || !loco.lon) return
        const color = LOCO_COLORS[loco.locomotive_id] ?? '#888'
        const isSelected = loco.locomotive_id === selectedId
        const hi = loco.health_index

        const svgSize = isSelected ? 28 : 22
        const ringColor = hi.status === 'normal' ? '#22c55e' : hi.status === 'warning' ? '#eab308' : '#ef4444'
        const svgIcon = L.divIcon({
          className: '',
          iconSize: [svgSize, svgSize],
          iconAnchor: [svgSize / 2, svgSize / 2],
          html: `
            <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
              ${isSelected ? `<circle cx="14" cy="14" r="13" fill="none" stroke="${color}" stroke-width="2" opacity="0.5"/>` : ''}
              <circle cx="14" cy="14" r="9" fill="${color}22" stroke="${ringColor}" stroke-width="2.5"/>
              <circle cx="14" cy="14" r="5" fill="${color}"/>
            </svg>`,
        })

        const existing = markersRef.current.get(loco.locomotive_id)
        if (existing) {
          existing.setLatLng([loco.lat, loco.lon])
          existing.setIcon(svgIcon)
        } else {
          const marker = L.marker([loco.lat, loco.lon], { icon: svgIcon })
            .addTo(mapRef.current)
            .bindTooltip(
              `<div style="font-family:JetBrains Mono,monospace;font-size:11px;background:#ffffff;border:1px solid #dbeafe;color:#0f172a;padding:6px 10px;border-radius:8px;box-shadow:0 8px 24px rgba(37,99,235,0.12);">
    <b>${loco.locomotive_id}</b> · ${loco.locomotive_type}<br/>
    HI: ${hi.score} · ${loco.speed_kmh.toFixed(0)} км/ч
  </div>`,
              { permanent: false, direction: 'top', className: 'loco-tooltip', offset: [0, -14] }
            )
          if (onSelect) {
            marker.on('click', () => onSelect(loco.locomotive_id))
          }
          markersRef.current.set(loco.locomotive_id, marker)
        }
      })
    })
  }, [locos, selectedId, onSelect, singleId])

  // Pan to selected loco
  useEffect(() => {
    if (!mapRef.current || !selectedId) return
    const loco = locos.find(l => l.locomotive_id === selectedId)
    if (loco) {
      mapRef.current.panTo([loco.lat, loco.lon], { animate: true, duration: 0.5 })
    }
  }, [selectedId, locos])

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-surface-border">
      <div ref={containerRef} className="w-full h-full" />
      <style>{`
        .loco-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; }
        .leaflet-tooltip { background: #161b26; border: 1px solid #1e2736; color: #e5e7eb; }
        .leaflet-control-zoom a {
  background: #ffffff !important;
  border-color: #bfdbfe !important;
  color: #2563eb !important;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.12) !important;
}

.leaflet-control-zoom a:hover {
  background: #eff6ff !important;
  color: #1d4ed8 !important;
}

.leaflet-control-zoom-in {
  border-bottom: 1px solid #dbeafe !important;
}

.leaflet-control-attribution {
  background: rgba(255, 255, 255, 0.9) !important;
  color: #64748b !important;
  font-size: 9px !important;
}

.leaflet-control-attribution a {
  color: #2563eb !important;
}
      `}</style>
      {!singleId && (
        <div className="absolute bottom-3 left-3 z-[1000] flex flex-col gap-1">
          {Object.entries(LOCO_COLORS).map(([id, color]) => (
            <div key={id} className="flex items-center gap-1.5 text-xs font-mono text-slate-600 bg-white/85 border border-blue-100 px-2 py-1 rounded-md shadow-sm">
              <span style={{ background: color }} className="w-2 h-2 rounded-full inline-block flex-shrink-0" />
              {id}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
