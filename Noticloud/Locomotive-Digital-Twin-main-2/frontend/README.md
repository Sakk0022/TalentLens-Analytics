# Цифровой двойник локомотива — Frontend

React + Vite + TypeScript дашборд для визуализации телеметрии локомотивов.

## Быстрый старт

```bash
npm install
npm run dev
# → http://localhost:5173
```

По умолчанию работает с **мок-симулятором** (данные генерируются прямо во фронте).

---

## Структура проекта

```
src/
├── types/          # TypeScript-типы (TelemetryPayload, LocomotiveState, ...)
├── mock/           # simulator.ts — клонирует логику Python-симулятора
├── services/       # telemetryService.ts — WS-клиент с fallback на mock
├── hooks/          # useTelemetry.ts — единый источник данных
├── components/
│   ├── shared/     # HealthRing, MetricCard, AlertList, Panel, LocoMap, ...
│   ├── driver/     # DriverDashboard, DriverPanel
│   └── dispatcher/ # DispatcherDashboard, LocoList, LocoDetail, FleetSummary
└── pages/          # RoleSelect
```

---

## Подключение реального бэкенда

### 1. Переключить на WebSocket

В `.env`:
```
VITE_USE_MOCK=false
VITE_WS_URL=ws://localhost:8000/ws/telemetry
```

### 2. Формат payload

Бэкенд должен слать через WebSocket **JSON-массив** или **единственный объект**:

```json
{
  "locomotive_id":   "LOCO-001",
  "locomotive_type": "TE33A",
  "timestamp":       "2026-04-04T14:30:00Z",
  "speed_kmh":       72.4,
  "resource_level":  58.2,
  "resource_type":   "fuel",
  "engine_temp_c":   91.2,
  "oil_temp_c":      84.0,
  "pressure_bar":    5.4,
  "alerts": [
    { "id": "temp", "level": "critical", "message": "Перегрев: 107°C", "timestamp": "..." }
  ],
  "lat": 51.18,
  "lon": 71.45,
  "health_index": {
    "score": 74,
    "status": "warning",
    "factors": [
      { "name": "Перегрев двигателя", "penalty": 15 }
    ],
    "recommendation": "Рекомендуется снизить скорость..."
  }
}
```

> Типы описаны в `src/types/index.ts` — синхронизируй с Pydantic-моделями бэкенда.

### 3. Удалить мок

Когда бэкенд готов:
- Удали `src/mock/simulator.ts`
- Убери импорт из `telemetryService.ts`
- Измени `USE_MOCK` на `false`

---

## Health Index

Формула в `src/mock/simulator.ts::computeHealthIndex()` **идентична** бэкенду:

```
HI = 100 - temp_penalty - pressure_penalty - resource_penalty - speed_penalty
```

| Диапазон | Статус   |
|----------|----------|
| 80–100   | normal   |
| 60–79    | warning  |
| 0–59     | critical |

---

## Профили локомотивов

| Параметр       | KZ8A (электровоз) | ТЭ33А (тепловоз) |
|----------------|-------------------|------------------|
| resource_type  | energy            | fuel             |
| Ресурс         | условный заряд    | топливо (%)      |

Оба отображаются единым UI-блоком — `resource_level` + `resource_type`.

---

## Команды

```bash
npm run dev      # dev-сервер
npm run build    # production build
npm run preview  # preview build
npm run lint     # ESLint
```
