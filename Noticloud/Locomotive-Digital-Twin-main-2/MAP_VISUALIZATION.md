# 🗺️ Визуализация маршрутов на карте

## Техническая информация о рисовании пунктирных путей

### 📍 Основной файл визуализации
**Файл:** [`frontend/src/components/shared/LocoMap.tsx`](frontend/src/components/shared/LocoMap.tsx)

Этот компонент React использует библиотеку **Leaflet** для отображения карты OpenStreetMap.

---

## 🎨 Как рисуется пунктирный путь

### Шаг 1: Инициализация Leaflet
```tsx
import('leaflet').then(L => {
  const map = L.map(containerRef.current, {
    center: [48.5, 68.0],  // Центр Казахстана
    zoom: 5,
    zoomControl: true,
  })
  
  // Добавить слой OpenStreetMap
  L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '© OpenStreetMap contributors', maxZoom: 19 }
  ).addTo(map)
})
```

### Шаг 2: Рисование маршрутов (пунктирные линии)
```tsx
const visibleIds = singleId ? [singleId] : Object.keys(ROUTES)
visibleIds.forEach(id => {
  const route = ROUTES[id]                    // Получить координаты маршрута
  if (!route) return
  
  const color = LOCO_COLORS[id] ?? '#888'     // Выбрать цвет по локомотиву
  
  const line = L.polyline(route as [number, number][], {
    color,                                    // Цвет линии
    weight: 2.5,                             // Толщина: 2.5 пикселя
    opacity: 0.55,                           // Прозрачность: 55%
    dashArray: '8 6',                        // 🔑 ПУНКТИР: 8px тире + 6px пропуск
  }).addTo(map)
  
  routeLinesRef.current.set(id, line)
})
```

### Шаг 3: Обновление маркеров локомотивов
```tsx
visibleLocos.forEach(loco => {
  if (!loco.lat || !loco.lon) return
  
  const color = LOCO_COLORS[loco.locomotive_id]
  const isSelected = loco.locomotive_id === selectedId
  const hi = loco.health_index
  
  // Создать SVG иконку с кольцом здоровья
  const svgIcon = L.divIcon({
    className: '',
    iconSize: [svgSize, svgSize],
    iconAnchor: [svgSize / 2, svgSize / 2],
    html: `
      <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 28 28">
        <!-- Внешнее кольцо (если выбран) -->
        ${isSelected ? `<circle cx="14" cy="14" r="13" stroke="${color}" stroke-width="2" opacity="0.5"/>` : ''}
        
        <!-- Светлый фон -->
        <circle cx="14" cy="14" r="9" fill="${color}22" stroke="${ringColor}" stroke-width="2.5"/>
        
        <!-- Основной маркер -->
        <circle cx="14" cy="14" r="5" fill="${color}"/>
      </svg>`
  })
  
  // Обновить или создать маркер на карте
  const marker = L.marker([loco.lat, loco.lon], { icon: svgIcon })
    .addTo(map)
    .bindTooltip(`<b>${loco.locomotive_id}</b> · ${loco.locomotive_type}<br/>HI: ${hi.score} · ${loco.speed_kmh.toFixed(0)} км/ч`)
})
```

---

## 🎭 Параметры визуализации

### Параметры пунктира
| Параметр | Значение | Описание |
|----------|----------|---------|
| `dashArray` | `'8 6'` | 8 пикселей тире, 6 пикселей пропуска |
| `weight` | `2.5` | Толщина линии в пикселях |
| `opacity` | `0.55` | Прозрачность 55% (видна под маркерами) |
| `color` | Варьируется | Зависит от LOCO_COLORS |

### Цветовое кодирование локомотивов
```typescript
export const LOCO_COLORS: Record<string, string> = {
  'LOCO-001': '#22c55e',  // 🟢 Зелёный (TE33A, Астана→Қарағанды)
  'LOCO-002': '#eab308',  // 🟡 Жёлтый (KZ8A, Астана→Петропавловск)
  'LOCO-003': '#3b82f6',  // 🔵 Синий (TE33A, Қарағанды→Балқаш)
  'LOCO-004': '#a78bfa',  // 🟣 Фиолетовый (KZ8A, Астана→Екібастұз)
}
```

### Иконки здоровья
- 🟢 **Зелёный** (status = 'normal') — все параметры в норме
- 🟡 **Жёлтый** (status = 'warning') — требуется внимание
- 🔴 **Красный** (status = 'critical') — требуется немедленная остановка

---

## 🗂️ Источники данных маршрутов

### ROUTES объект
**Файл:** `frontend/src/mock/simulator.ts` (строки 8-37)

```typescript
export const ROUTES: Record<string, [number, number][]> = {
  'LOCO-001': [
    [51.1694, 71.4491],   // Астана (начало)
    [50.8500, 71.8000],   // Промежуточная точка 1
    [50.5000, 72.2000],   // Промежуточная точка 2
    [50.0000, 72.7000],   // Промежуточная точка 3
    [49.8047, 73.1033],   // Қарағанды (конец)
  ],
  'LOCO-002': [...],      // Астана → Петропавловск
  'LOCO-003': [...],      // Қарағанды → Балқаш
  'LOCO-004': [...],      // Астана → Екібастұз
}
```

**Эти координаты точно совпадают с waypoints в backend симуляторе!** ✅

---

## 🖱️ Взаимодействие с пользователем

### Клик на маркер локомотива
```tsx
if (onSelect) {
  marker.on('click', () => onSelect(loco.locomotive_id))
}
```
- Маркер выделяется внешним кольцом
- В левой панели отображается детальная информация
- Пан до локомотива с анимацией

### Всплывающая подсказка
```tsx
.bindTooltip(
  `<b>${loco.locomotive_id}</b> · ${loco.locomotive_type}<br/>
   HI: ${hi.score} · ${loco.speed_kmh.toFixed(0)} км/ч`,
  { permanent: false, direction: 'top', offset: [0, -14] }
)
```
Появляется при наведении на маркер

---

## 🎬 Управление видимостью

### Режим просмотра всех локомотивов
- Отображаются 4 пунктирных маршрута с разными цветами
- Отображаются 4 маркера локомотивов
- Левая панель показывает легенду с цветовым кодированием

### Режим просмотра одного локомотива (singleId)
- Отображается только маршрут выбранного локомотива
- Отображается только маркер выбранного локомотива
- Карта автоматически центрируется на локомотиве

---

## ⚡ Оптимизация производительности

### Ref-ы для хранения объектов Leaflet
```tsx
const mapRef = useRef<any>(null)                    // Сама карта
const markersRef = useRef<Map<string, any>>()      // Маркеры локомотивов
const routeLinesRef = useRef<Map<string, any>>()   // Линии маршрутов
```

### Ленивая загрузка Leaflet
```tsx
import('leaflet').then(L => {
  // Код инициализации запускается только при первом рендере
})
```

### Обновление только измененных маркеров
```tsx
const existing = markersRef.current.get(loco.locomotive_id)
if (existing) {
  existing.setLatLng([loco.lat, loco.lon])  // Только переместить
  existing.setIcon(svgIcon)                  // Только обновить иконку
} else {
  const marker = L.marker(...).addTo(mapRef.current)  // Создать новый
}
```

---

## 🔧 Модификация параметров

### Изменить пунктир
В `LocoMap.tsx` строка 64:
```tsx
dashArray: '8 6',  // Измените это
// Примеры:
// '5 5'   - густой пунктир
// '15 5'  - редкий пунктир
// null    - сплошная линия
```

### Изменить прозрачность
В `LocoMap.tsx` строка 63:
```tsx
opacity: 0.55,  // Измените на 0.3-1.0
```

### Изменить толщину
В `LocoMap.tsx` строка 62:
```tsx
weight: 2.5,  // Измените на нужное значение
```

### Добавить новый цвет
В `LocoMap.tsx` строка 14:
```typescript
export const LOCO_COLORS: Record<string, string> = {
  'LOCO-001': '#22c55e',
  'LOCO-002': '#eab308',
  'LOCO-003': '#3b82f6',
  'LOCO-004': '#a78bfa',
  'LOCO-005': '#ff6b6b',  // ← Новый локомотив
}
```

---

## 📚 Используемые библиотеки

- **Leaflet** (`L.map`, `L.polyline`, `L.marker`, `L.divIcon`, `L.tileLayer`)
- **OpenStreetMap** (бесплатные тайлы карты)
- **React Hooks** (`useEffect`, `useRef`)
- **TypeScript** (типизация)

---

## 🐛 Отладка

### Добавить логи для отслеживания
```tsx
console.log('Drawing route for:', id, 'with', route.length, 'waypoints')
console.log('Loco position:', loco.lat, loco.lon)
console.log('Health index:', hi.score, 'Status:', hi.status)
```

### Проверить координаты в консоли
```javascript
// В браузере откройте DevTools (F12) и вставьте:
console.log(Object.entries(ROUTES))
```

### Убедиться, что маршруты совпадают
```python
# В backend терминале:
python -c "from simulator import FLEET; import json; print(json.dumps([{l['locomotive_id']: l['waypoints']} for l in FLEET], indent=2))"
```
