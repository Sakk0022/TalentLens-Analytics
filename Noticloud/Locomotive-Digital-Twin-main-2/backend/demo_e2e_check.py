import asyncio
import json
import sys
from copy import deepcopy
import traceback

import requests

try:
    import websockets
except ImportError:
    websockets = None


BASE_URL = "http://127.0.0.1:8000"
WS_LIVE_URL = "ws://127.0.0.1:8000/ws/live"
WS_SIM_URL = "ws://127.0.0.1:8000/ws/simulator"

ADMIN_LOGIN = {"username": "admin", "password": "admin123"}

TE33A_PAYLOAD = {
    "locomotive_id": "TE33A-DEMO-001",
    "locomotive_type": "TE33A",
    "timestamp": "2026-04-05T12:00:00Z",
    "scenario": "warning",
    "step": 1,
    "speed_kmh": 116.0,
    "fuel_liters": 820.0,
    "fuel_percent": 10.3,
    "rpm": 2050,
    "engine_temp_c": 98.0,
    "exhaust_temp_c": 620.0,
    "oil_temp_c": 92.0,
    "oil_pressure_bar": 3.1,
    "brake_pressure_bar": 5.4,
    "compressor_bar": 8.9,
    "voltage_aux_v": 82.0,
    "alerts": [
        {
            "code": "F001",
            "severity": "WARNING",
            "msg": "Температура двигателя повышена",
            "recommend": "Снизьте нагрузку",
        }
    ],
    "lat": 51.17,
    "lon": 71.44,
}


def ok(message: str) -> None:
    print(f"[OK] {message}")


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    raise AssertionError(message)


def assert_status(response: requests.Response, expected: int, label: str) -> None:
    if response.status_code != expected:
        fail(f"{label}: expected {expected}, got {response.status_code}, body={response.text}")
    ok(label)


def login_admin() -> str:
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_LOGIN, timeout=10)
    assert_status(response, 200, "POST /api/auth/login")
    return response.json()["access_token"]


def check_basic_endpoints() -> None:
    for path in ["/health", "/ready", "/metrics", "/api/config"]:
        response = requests.get(f"{BASE_URL}{path}", timeout=10)
        assert_status(response, 200, f"GET {path}")


def check_http_ingest() -> None:
    response = requests.post(f"{BASE_URL}/api/telemetry/ingest", json=TE33A_PAYLOAD, timeout=10)
    if response.status_code not in (200, 201):
        fail(f"POST /api/telemetry/ingest failed: {response.status_code}, body={response.text}")
    ok("POST /api/telemetry/ingest")


def check_history_health_alerts() -> None:
    endpoints = [
        "/api/history?locomotive_id=TE33A-DEMO-001&limit=5",
        "/api/alerts?locomotive_id=TE33A-DEMO-001&limit=10",
        "/api/health?locomotive_id=TE33A-DEMO-001&limit=10",
        "/api/history/replay?locomotive_id=TE33A-DEMO-001&minutes=120",
        "/api/history/events?locomotive_id=TE33A-DEMO-001",
    ]

    for path in endpoints:
        response = requests.get(f"{BASE_URL}{path}", timeout=10)
        assert_status(response, 200, f"GET {path}")


def check_exports() -> None:
    csv_response = requests.get(
        f"{BASE_URL}/api/report/csv?locomotive_id=TE33A-DEMO-001",
        timeout=20,
    )
    assert_status(csv_response, 200, "GET /api/report/csv")
    if "text/csv" not in csv_response.headers.get("content-type", ""):
        fail("CSV export has wrong content-type")

    pdf_response = requests.get(
        f"{BASE_URL}/api/report/pdf?locomotive_id=TE33A-DEMO-001",
        timeout=20,
    )
    assert_status(pdf_response, 200, "GET /api/report/pdf")
    if "application/pdf" not in pdf_response.headers.get("content-type", ""):
        fail("PDF export has wrong content-type")


def check_admin_update(token: str) -> None:
    body = {
        "label": "Температура двигателя",
        "unit": "°C",
        "direction": "high",
        "norm": [60, 95],
        "warning": [95, 102],
        "critical": [102, 999],
        "penalty_warn": 8,
        "penalty_crit": 20,
        "alert_code": "F001",
        "alert_msg": "Перегрев двигателя",
        "recommend_warn": "Снизьте нагрузку. Следите за динамикой температуры.",
        "recommend_crit": "Немедленно снизить скорость.",
    }

    response = requests.put(
        f"{BASE_URL}/api/config/TE33A/engine_temp_c",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert_status(response, 200, "PUT /api/config/TE33A/engine_temp_c")


async def check_ws_live() -> None:
    if websockets is None:
        print("[SKIP] websockets not installed, ws/live skipped")
        return

    async with websockets.connect(WS_LIVE_URL) as ws:
        first = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        if first["type"] != "connection_status":
            fail("WS /ws/live did not send connection_status")
        ok("WS /ws/live connected")

        await ws.send("ping")

        payload = deepcopy(TE33A_PAYLOAD)
        payload["timestamp"] = "2026-04-05T12:05:00Z"
        payload["step"] = 2

        response = requests.post(f"{BASE_URL}/api/telemetry/ingest", json=payload, timeout=10)
        if response.status_code not in (200, 201):
            fail(f"WS live test HTTP ingest failed: {response.status_code}, body={response.text}")

        second = json.loads(await asyncio.wait_for(ws.recv(), timeout=8))
        if second["type"] != "telemetry_update":
            fail(f"WS /ws/live expected telemetry_update, got {second}")
        ok("WS /ws/live broadcast received")


async def check_ws_simulator() -> None:
    if websockets is None:
        print("[SKIP] websockets not installed, ws/simulator skipped")
        return

    payload = deepcopy(TE33A_PAYLOAD)
    payload["timestamp"] = "2026-04-05T12:06:00Z"
    payload["step"] = 3

    async with websockets.connect(WS_SIM_URL) as ws:
        first = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        if first["type"] != "connection_status":
            fail(f"WS /ws/simulator expected connection_status, got {first}")
        ok("WS /ws/simulator connected")

        await ws.send(json.dumps(payload, ensure_ascii=False))

        ack = json.loads(await asyncio.wait_for(ws.recv(), timeout=8))
        if ack["type"] != "ack":
            fail(f"WS /ws/simulator expected ack, got {ack}")
        ok("WS /ws/simulator ack received")


def main() -> None:
    print("=== DEMO E2E CHECK START ===")

    token = login_admin()
    check_basic_endpoints()
    check_http_ingest()
    check_history_health_alerts()
    check_exports()
    check_admin_update(token)

    asyncio.run(check_ws_live())
    asyncio.run(check_ws_simulator())

    print("=== DEMO E2E CHECK PASSED ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[ERROR] {repr(e)}")
        traceback.print_exc()
        sys.exit(1)