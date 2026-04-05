import json
import sys
from copy import deepcopy

import requests

BASE_URL = "http://127.0.0.1:8000"


LOGIN_ADMIN = {
    "username": "admin",
    "password": "admin123",
}

LOGIN_VIEWER = {
    "username": "viewer",
    "password": "viewer123",
}

TE33A_PAYLOAD = {
    "locomotive_id": "TE33A-OPS-001",
    "locomotive_type": "TE33A",
    "timestamp": "2026-04-05T10:30:00Z",
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
    "alerts": [],
    "lat": 51.18,
    "lon": 71.45,
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


def get_json(path: str, label: str):
    response = requests.get(f"{BASE_URL}{path}", timeout=10)
    assert_status(response, 200, label)
    return response.json()


def test_health() -> None:
    data = get_json("/health", "GET /health")
    if data.get("status") != "ok":
        fail("GET /health: status is not ok")


def test_ready() -> None:
    data = get_json("/ready", "GET /ready")
    if data.get("ready") is not True:
        fail("GET /ready: ready is not true")


def test_login(credentials: dict, expected_role: str) -> str:
    response = requests.post(f"{BASE_URL}/api/auth/login", json=credentials, timeout=10)
    assert_status(response, 200, f"POST /api/auth/login ({expected_role})")
    data = response.json()

    if "access_token" not in data:
        fail("Login response has no access_token")
    if data.get("role") != expected_role:
        fail(f"Login role mismatch: expected {expected_role}, got {data.get('role')}")

    return data["access_token"]


def test_auth_me(token: str, expected_role: str) -> None:
    response = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert_status(response, 200, f"GET /api/auth/me ({expected_role})")
    data = response.json()

    if data.get("role") != expected_role:
        fail(f"/me role mismatch: expected {expected_role}, got {data.get('role')}")


def test_admin_rbac(viewer_token: str, admin_token: str) -> None:
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

    # viewer должен получить отказ
    viewer_response = requests.put(
        f"{BASE_URL}/api/config/TE33A/engine_temp_c",
        json=body,
        headers={"Authorization": f"Bearer {viewer_token}"},
        timeout=10,
    )
    if viewer_response.status_code not in (401, 403):
        fail(
            f"Viewer should not update config, got {viewer_response.status_code}, body={viewer_response.text}"
        )
    ok("RBAC blocks viewer on PUT /api/config/...")

    # admin должен пройти
    admin_response = requests.put(
        f"{BASE_URL}/api/config/TE33A/engine_temp_c",
        json=body,
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10,
    )
    assert_status(admin_response, 200, "RBAC allows admin on PUT /api/config/...")


def test_ingest_rate_limit() -> None:
    # при лимите 3 в минуту 4-й запрос должен дать 429
    last_status = None

    for i in range(4):
        payload = deepcopy(TE33A_PAYLOAD)
        payload["timestamp"] = f"2026-04-05T10:30:0{i}Z"
        payload["step"] = i + 1

        response = requests.post(
            f"{BASE_URL}/api/telemetry/ingest",
            json=payload,
            timeout=10,
        )
        last_status = response.status_code

    if last_status != 429:
        fail(f"Rate limit on ingest did not trigger, last status={last_status}")
    ok("Rate limit works on POST /api/telemetry/ingest")


def test_admin_rate_limit(admin_token: str) -> None:
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

    statuses = []

    for _ in range(3):
        response = requests.put(
            f"{BASE_URL}/api/config/TE33A/engine_temp_c",
            json=body,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10,
        )
        statuses.append(response.status_code)

    if 429 not in statuses:
        fail(f"Rate limit on admin route did not trigger, statuses={statuses}")
    ok("Rate limit works on PUT /api/config/...")


def test_metrics() -> None:
    response = requests.get(f"{BASE_URL}/metrics", timeout=10)
    assert_status(response, 200, "GET /metrics")

    body = response.text

    required_metric_names = [
        "app_http_requests_total",
        "app_http_request_duration_seconds",
        "app_ingest_requests_total",
        "app_database_up",
        "app_readiness",
    ]

    for metric_name in required_metric_names:
        if metric_name not in body:
            fail(f"/metrics does not contain {metric_name}")

    ok("/metrics contains required metric names")


def main() -> None:
    print("=== BACKEND OPS VERIFICATION START ===")

    test_health()
    test_ready()

    admin_token = test_login(LOGIN_ADMIN, "admin")
    viewer_token = test_login(LOGIN_VIEWER, "viewer")

    test_auth_me(admin_token, "admin")
    test_auth_me(viewer_token, "viewer")

    test_admin_rbac(viewer_token, admin_token)
    test_ingest_rate_limit()
    test_admin_rate_limit(admin_token)
    test_metrics()

    print("=== BACKEND OPS VERIFICATION PASSED ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)