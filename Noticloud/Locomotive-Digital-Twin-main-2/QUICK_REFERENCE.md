# ⚡ Быстрая справка: Маршруты локомотивов

## 📋 Четыре маршрута

| ID | Тип | Маршрут | Начало | Конец | Расстояние | Скорость |
|----|-----|---------|--------|-------|-----------|----------|
| LOCO-001 | TE33A 🟢 | Астана → Қарағанды | (51.17, 71.45) | (49.80, 73.10) | 193 км | 120 км/ч |
| LOCO-002 | KZ8A 🟡 | Астана → Петропавловск | (51.17, 71.45) | (54.88, 69.18) | 445 км | 200 км/ч |
| LOCO-003 | TE33A 🔵 | Қарағанды → Балқаш | (49.80, 73.10) | (46.85, 73.35) | 329 км | 120 км/ч |
| LOCO-004 | KZ8A 🟣 | Астана → Екібастұз | (51.17, 71.45) | (51.68, 75.28) | 272 км | 200 км/ч |

## 🖼️ Где рисуется пунктир?

**Файл:** `frontend/src/components/shared/LocoMap.tsx` (строки 57-70)

```tsx
const line = L.polyline(route, {
  color: color,
  weight: 2.5,
  opacity: 0.55,
  dashArray: '8 6',  // ← ПУНКТИР ЗДЕСЬ!
}).addTo(map)
```

## ✅ Что проверить

```bash
# 1. Запустить симулятор
cd backend
python simulator.py --type FLEET --mode normal --count 20 --interval 1

# 2. Открыть браузер
http://localhost:5173

# 3. На карте должны быть:
# ✅ 4 пунктирных маршрута разных цветов
# ✅ 4 маркера локомотивов на начальных точках
# ✅ Маркеры плавно движутся вдоль маршрутов
```

## 🔧 Ключевые функции

### Backend (`simulator.py`)
- `calculate_total_waypoint_distance(waypoints)` — расчет расстояния по Haversine
- `get_position_on_route(waypoints, progress)` — интерполяция позиции (0.0-1.0)

### Frontend (`src/mock/simulator.ts`)
- `ROUTES` — координаты всех маршрутов (синхронизировано с backend)
- `advanceAlongRoute()` — движение локомотива по маршруту

### Frontend (`src/components/shared/LocoMap.tsx`)
- `L.polyline(route, { dashArray: '8 6' })` — рисование пунктирной линии

## 💡 Как работает движение

```
1. Локомотив начинает с progress = 0.0 (первая точка маршрута)
2. Каждое сообщение: progress += distance_per_message / total_distance
3. Функция get_position_on_route() интерполирует координаты
4. Маркер обновляется на карте
5. Когда progress >= 1.0, маршрут завершен (или циклится)
```

## 📍 Координаты на карте

```
Астана:            51.1694°N, 71.4491°E 🌍
Қарағанды:         49.8047°N, 73.1033°E 🌍
Петропавловск:    54.8808°N, 69.1846°E 🌍
Балқаш:           46.8497°N, 73.3472°E 🌍
Екібастұз:        51.6833°N, 75.2833°E 🌍
```

## 🎨 Цвета маршрутов

```
LOCO-001 → 🟢 #22c55e (зелёный)
LOCO-002 → 🟡 #eab308 (жёлтый)
LOCO-003 → 🔵 #3b82f6 (синий)
LOCO-004 → 🟣 #a78bfa (фиолетовый)
```

## 📝 Файлы с документацией

1. **[ROUTE_SETUP.md](ROUTE_SETUP.md)** — подробное описание маршрутов
2. **[MAP_VISUALIZATION.md](MAP_VISUALIZATION.md)** — как рисуется карта
3. **[ROUTES_SUMMARY.md](ROUTES_SUMMARY.md)** — полное резюме

## 🚀 Быстрый старт

```bash
# Terminal 1: Backend
cd backend
/Users/aleksandrsudro/Desktop/Locomotive-Digital-Twin-main/backend/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2: Simulator
cd backend
/Users/aleksandrsudro/Desktop/Locomotive-Digital-Twin-main/backend/venv/bin/python simulator.py --type FLEET --mode normal --count 100 --interval 2

# Terminal 3: Frontend
cd frontend
npm run dev

# Браузер: http://localhost:5178 (или 5173-5177)
```

## ❓ FAQ

**Q: Почему маршруты не совпадают?**
A: ROUTES в frontend должны точно совпадать с waypoints в backend. Проверьте [ROUTE_SETUP.md](ROUTE_SETUP.md)

**Q: Как изменить пунктир?**
A: Отредактируйте `dashArray` в [LocoMap.tsx](frontend/src/components/shared/LocoMap.tsx#L64)

**Q: Почему локомотив прыгает, а не плывет?**
A: Проверьте, что `advanceAlongRoute()` в [simulator.ts](frontend/src/mock/simulator.ts) работает правильно

**Q: Как добавить новый маршрут?**
A: Добавьте элемент в FLEET (backend) и ROUTES (frontend), не забудьте добавить цвет в LOCO_COLORS

## 📊 Статистика

- ✅ 4 локомотива
- ✅ 5 точек на маршрут (20 всего waypoints)
- ✅ 4 цвета маршрутов
- ✅ 193-445 км расстояние маршрутов
- ✅ 120-200 км/ч максимальная скорость

---

**Последнее обновление:** 2026-04-04  
**Статус:** ✅ Готово к использованию  
**Тестировано:** ✅ Да

## Физическая модель (кратко)

- Расчёт тяговой силы: F_traction = M*g*Cr + 0.5*rho*Cd*A*v^2
- Нагрузка (load_percent) = F_traction / F_max (в процентах)
- Расход топлива (TE33A): Q_km = 1.2 * (1 + 1.8*Load) * (v/80)^1.15
- Q_h = Q_km * v; Range_km = fuel_left / Q_km

Эти расчёты реализованы в `backend/simulator.py` и используются для уменьшения `fuel_liters` на тиках симулятора.

## Запуск (рекомендуется `.venv`)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
.venv/bin/python -m pip install -r requirements.txt websockets PyJWT reportlab prometheus-client
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend (отдельно):

```bash
cd frontend
npm install
npm run dev
```

## Последнее обновление: 2026-04-05
