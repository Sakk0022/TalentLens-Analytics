import asyncio
import json
from copy import deepcopy

import requests

try:
    import websockets
except ImportError:
    websockets = None


BASE_URL = "http://127.0.0.1:8000"
WS_LIVE_URL = "ws://127.0.0.1:8000/ws/live"
WS_SIM_URL = "ws://127.0.0.1:8000/ws/simulator"


TE33A_PAYLOAD = {
    "locomotive_id": "TE33A-0089",
    "locomotive_type": "TE33A",
    "timestamp": "2026-04-04T10:30:00Z",
    "scenario": "normal",
    "step": 1,
    "speed_kmh": 72.4,
    "fuel_liters": 5480.0,
    "fuel_percent": 68.5,
    "rpm": 1850,
    "engine_temp_c": 88.2,
    "exhaust_temp_c": 480.0,
    "oil_temp_c": 81.0,
    "oil_pressure_bar": 4.2,
    "brake_pressure_bar": 6.2,
    "compressor_bar": 8.8,
    "voltage_aux_v": 96.0,
    "alerts": [
        {
            "code": "F001",
            "severity": "WARNING",
            "msg": "Температура двигателя повышена",
            "recommend": "Снизьте нагрузку",
        }
    ],
    "lat": 51.18,
    "lon": 71.45,
}

KZ8A_PAYLOAD = {
    "locomotive_id": "KZ8A-0001",
    "locomotive_type": "KZ8A",
    "timestamp": "2026-04-04T10:45:00Z",
    "scenario": "normal",
    "step": 1,
    "speed_kmh": 88.0,
    "fuel_liters": None,
    "fuel_percent": None,
    "rpm": None,
    "engine_temp_c": 72.0,
    "exhaust_temp_c": None,
    "oil_temp_c": 64.0,
    "oil_pressure_bar": None,
    "brake_pressure_bar": 6.3,
    "compressor_bar": 8.7,
    "voltage_aux_v": 98.0,
    "alerts": [],
    "lat": 51.20,
    "lon": 71.50,
}


def log_ok(message: str) -> None:
    print(f"[OK] {message}")


def log_fail(message: str) -> None:
    print(f"[FAIL] {message}")


def assert_status(response: requests.Response, expected: int, label: str) -> None:
    if response.status_code != expected:
        raise AssertionError(
            f"{label} -> expected {expected}, got {response.status_code}, body={response.text}"
        )


def get_json(path: str, label: str) -> dict | list:
    response = requests.get(f"{BASE_URL}{path}", timeout=10)
    assert_status(response, 200, label)
    log_ok(label)
    return response.json()


def test_healthcheck() -> None:
    data = get_json("/health", "GET /health")
    assert "status" in data
    assert data["status"] == "ok"


def test_config() -> None:
    data = get_json("/api/config", "GET /api/config")
    assert "profiles" in data
    assert isinstance(data["profiles"], list)
    assert any(p["locomotive_type"] == "TE33A" for p in data["profiles"])
    assert any(p["locomotive_type"] == "KZ8A" for p in data["profiles"])


def test_ingest_http(payload: dict, label: str) -> dict:
    response = requests.post(
        f"{BASE_URL}/api/telemetry/ingest",
        json=payload,
        timeout=10,
    )
    assert_status(response, 201, label)
    data = response.json()
    log_ok(label)
    assert data["locomotive_type"] == payload["locomotive_type"]
    assert data["locomotive_id"] == payload["locomotive_id"]
    return data


def test_history() -> None:
    data = get_json("/api/history?limit=5", "GET /api/history")
    assert isinstance(data, list)


def test_alerts() -> None:
    data = get_json("/api/alerts?limit=10", "GET /api/alerts")
    assert isinstance(data, list)


def test_health_api() -> None:
    data = get_json("/api/health?limit=10", "GET /api/health")
    assert isinstance(data, list)


def test_report_csv() -> None:
    response = requests.get(f"{BASE_URL}/api/report/csv", timeout=20)
    assert_status(response, 200, "GET /api/report/csv")
    content_type = response.headers.get("content-type", "")
    if "text/csv" not in content_type:
        raise AssertionError(f"CSV endpoint returned wrong content-type: {content_type}")
    log_ok("GET /api/report/csv")


async def test_ws_live() -> None:
    if websockets is None:
        print("[SKIP] websockets package is not installed, ws/live check skipped")
        return

    async with websockets.connect(WS_LIVE_URL) as ws:
        first_message = await asyncio.wait_for(ws.recv(), timeout=5)
        first_data = json.loads(first_message)
        assert first_data["type"] == "connection_status"
        log_ok("WS /ws/live connection")

        payload = deepcopy(TE33A_PAYLOAD)
        payload["timestamp"] = "2026-04-04T11:00:00Z"
        response = requests.post(f"{BASE_URL}/api/telemetry/ingest", json=payload, timeout=10)
        assert_status(response, 201, "HTTP ingest during ws/live test")

        second_message = await asyncio.wait_for(ws.recv(), timeout=5)
        second_data = json.loads(second_message)
        assert second_data["type"] == "telemetry_update"
        log_ok("WS /ws/live broadcast")


async def test_ws_simulator() -> None:
    if websockets is None:
        print("[SKIP] websockets package is not installed, ws/simulator check skipped")
        return

    payload = deepcopy(TE33A_PAYLOAD)
    payload["timestamp"] = "2026-04-04T11:05:00Z"
    payload["step"] = 999

    async with websockets.connect(WS_SIM_URL) as ws:
        first_message = await asyncio.wait_for(ws.recv(), timeout=5)
        first_data = json.loads(first_message)
        assert first_data["type"] == "connection_status"
        log_ok("WS /ws/simulator connection")

        await ws.send(json.dumps(payload, ensure_ascii=False))

        ack_message = await asyncio.wait_for(ws.recv(), timeout=5)
        ack_data = json.loads(ack_message)
        assert ack_data["type"] == "ack"
        assert ack_data["status"] == "ok"
        log_ok("WS /ws/simulator ack")


def main() -> None:
    print("=== BACKEND SMOKE TEST START ===")

    test_healthcheck()
    test_config()

    test_ingest_http(deepcopy(TE33A_PAYLOAD), "POST /api/telemetry/ingest (TE33A)")
    test_ingest_http(deepcopy(KZ8A_PAYLOAD), "POST /api/telemetry/ingest (KZ8A)")

    test_history()
    test_alerts()
    test_health_api()
    test_report_csv()

    asyncio.run(test_ws_live())
    asyncio.run(test_ws_simulator())

    print("=== BACKEND SMOKE TEST PASSED ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log_fail(str(e))
        raise