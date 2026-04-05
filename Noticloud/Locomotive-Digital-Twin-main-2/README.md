# Locomotive Digital Twin Backend

Backend для хакатон-проекта **«Цифровой двойник локомотива»**.

Система принимает поток телеметрии локомотива, сохраняет данные в PostgreSQL, рассчитывает alerts и health index, отдает историю, realtime-события по WebSocket и CSV-отчет.

## Функциональность

- Прием телеметрии через REST
- История телеметрии
- Alerts API
- Health Index API
- Конфигурация профилей локомотивов
- Обновление config без перекомпиляции
- Realtime через WebSocket
- CSV export
- Healthcheck
- Базовая admin-защита для изменения config

## Поддерживаемые профили

- `KZ8A` — электровоз
- `TE33A` — тепловоз

## Основной стек

- FastAPI
- PostgreSQL
- SQLAlchemy
- WebSocket
- Uvicorn
- Python 3.12+
- venv

## Структура проекта

```text
backend/
  app/
    api/
      alerts.py
      config.py
      health.py
      healthcheck.py
      history.py
      report.py
      telemetry.py
      ws.py
    core/
      logging.py
      profiles.py
      security.py
      settings.py
    db/
      base.py
      init_db.py
      models.py
      session.py
    schemas/
      alert.py
      common.py
      config.py
      health.py
      telemetry.py
    services/
      alerts_service.py
      health_service.py
      live_service.py
    main.py
  simulator.py
  requirements.txt
  .env
  README.md
```

## Установка

### 1. Создать и активировать виртуальное окружение

#### Windows PowerShell
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

#### macOS / Linux
```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Установить зависимости
```bash
pip install -r requirements.txt
```

## Настройка `.env`

Создай файл `.env` в корне проекта:

```env
APP_NAME=Locomotive Digital Twin API
APP_VERSION=0.1.0
DEBUG=true
HOST=127.0.0.1
PORT=8000

DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/ktz_locomotive
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ADMIN_API_KEY=supersecret123
```

## PostgreSQL

Нужно создать базу данных:

```sql
CREATE DATABASE ktz_locomotive;
```

## Запуск проекта

```bash
uvicorn app.main:app --reload
```

После запуска доступны:

- Swagger: `http://127.0.0.1:8000/docs`
- Healthcheck: `http://127.0.0.1:8000/health`

## Основные endpoints

### Healthcheck
- `GET /health`

### Telemetry
- `POST /api/telemetry/ingest`

### History
- `GET /api/history`

### Alerts
- `GET /api/alerts`

### Health Index
- `GET /api/health`

### Config
- `GET /api/config`
- `PUT /api/config/{locomotive_type}/{parameter}`

### Report
- `GET /api/report/csv`

### WebSocket
- `WS /ws/live`

## Пример payload для ingest

### TE33A
```json
{
  "locomotive_id": "LOCO-001",
  "locomotive_type": "TE33A",
  "timestamp": "2026-04-04T17:00:00",
  "speed_kmh": 125.0,
  "resource_level": 18.0,
  "resource_type": "fuel",
  "engine_temp_c": 103.0,
  "oil_temp_c": 91.0,
  "pressure_bar": 3.7,
  "alerts": ["SENSOR_WARN_01"],
  "lat": 51.12,
  "lon": 71.41
}
```

### KZ8A
```json
{
  "locomotive_id": "LOCO-002",
  "locomotive_type": "KZ8A",
  "timestamp": "2026-04-04T17:05:00",
  "speed_kmh": 118.0,
  "resource_level": 28.0,
  "resource_type": "energy",
  "engine_temp_c": 92.0,
  "oil_temp_c": 81.0,
  "pressure_bar": 4.3,
  "alerts": ["ENERGY_WARN_01"],
  "lat": 51.18,
  "lon": 71.46
}
```

## Тестирование симулятором

### Normal
```bash
python simulator.py --type TE33A --mode normal --count 20 --interval 1
```

### Warning
```bash
python simulator.py --type TE33A --mode warning --count 20 --interval 1
```

### Critical
```bash
python simulator.py --type KZ8A --mode critical --count 20 --interval 1
```

### Highload
```bash
python simulator.py --type TE33A --mode highload --count 100 --interval 0.1
```

## Проверка WebSocket

Через `wscat`:

```bash
wscat -c ws://127.0.0.1:8000/ws/live
```

После подключения можно отправить:

```text
ping
```

## Обновление config

Для изменения thresholds нужен header:

```text
X-API-Key: supersecret123
```

Пример:
```http
PUT /api/config/TE33A/engine_temp_c
```

Body:
```json
{
  "warning_min": null,
  "warning_max": 97.0,
  "critical_min": null,
  "critical_max": 107.0,
  "weight": 0.35
}
```

## Что уже реализовано

- FastAPI backend
- PostgreSQL integration
- Telemetry ingest
- History API
- Alerts API
- Health API
- Config API
- WebSocket realtime
- CSV export
- Logging
- CORS
- Error handling
- Basic admin protection for config updates

## Recent updates (2026-04-05)

- Добавлена физическая модель потребления топлива и расчёта нагрузки двигателя в симуляторе (`backend/simulator.py`). Масса и скорость теперь влияют на `load_percent`, `fuel_per_km` и уменьшение топлива.
- Исправлена логика аутентификации на фронтенде: `frontend/src/App.tsx` теперь вызывает `/api/auth/login` и сохраняет JWT, UI отражает состояние бэка (health/config/alerts).
- Добавлены экспорт PDF/CSV (эндпоинты в `backend/app/api/report.py`) и кнопки в UI для скачивания отчётов.
- Инструкции по запуску через виртуальное окружение (`.venv`) и рекомендации для macOS добавлены ниже.

## Recommended local run (macOS / Linux)

1) Создать `.venv` и установить зависимости:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt websockets PyJWT prometheus-client reportlab
```

2) Запустить backend (рекомендуется через `.venv`):

```bash
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

3) Запустить симулятор (пример):

```bash
.venv/bin/python simulator.py --type TE33A --mode normal --count 20 --interval 1
```

4) Запустить фронтенд (в другой вкладке):

```bash
cd frontend
npm install
npm run dev
```

5) Демо-учётки (по умолчанию, в `app/core/settings.py`):

- admin / admin123
- operator / operator123
- viewer / viewer123

## Troubleshooting notes

- Если при запуске `uvicorn` получаете "address already in use" — найдите процесс на порту 8000 (`lsof -i :8000`) и остановите его, или выберите другой порт.
- WebSocket: симулятор иногда показывает кратковременные тайм-ауты ping — это ожидаемо в локальной сети; если соединение часто падает, проверьте нагрузку и логирование.
- PDF/CSV: убедитесь, что пакет `reportlab` установлен в окружении, чтобы генерировать PDF.


## запуск FRONT

```bash
cd frontend
npm install
npm run dev
```

.env
```bash
VITE_USE_MOCK=false
#VITE_WS_URL=ws://localhost:8000/ws/telemetry

VITE_API_BASE=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000/ws/live
```

