from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AlertsHistory, ProfileConfig
from app.schemas.telemetry import TelemetryIn


PARAMETER_LABELS = {
    "speed_kmh": "Speed",
    "resource_level": "Resource level",
    "engine_temp_c": "Engine temperature",
    "oil_temp_c": "Oil temperature",
    "pressure_bar": "Pressure",
}


def _is_below(value: float, threshold: float | None) -> bool:
    return threshold is not None and value < threshold


def _is_above(value: float, threshold: float | None) -> bool:
    return threshold is not None and value > threshold


def generate_threshold_alerts(payload: TelemetryIn, db: Session) -> list[dict[str, str]]:
    rows = db.execute(
        select(ProfileConfig).where(ProfileConfig.locomotive_type == payload.locomotive_type)
    ).scalars().all()

    alerts: list[dict[str, str]] = []

    for row in rows:
        value = getattr(payload, row.parameter, None)
        if value is None:
            continue

        label = PARAMETER_LABELS.get(row.parameter, row.parameter)

        is_critical = _is_below(value, row.critical_min) or _is_above(value, row.critical_max)
        is_warning = _is_below(value, row.warning_min) or _is_above(value, row.warning_max)

        if is_critical:
            alerts.append(
                {
                    "severity": "critical",
                    "code": f"{row.parameter.upper()}_CRITICAL",
                    "message": f"{label} is in critical range: {value}",
                }
            )
        elif is_warning:
            alerts.append(
                {
                    "severity": "warning",
                    "code": f"{row.parameter.upper()}_WARNING",
                    "message": f"{label} is outside normal range: {value}",
                }
            )

    return alerts


def generate_payload_alerts(payload: TelemetryIn) -> list[dict[str, str]]:
    alerts: list[dict[str, str]] = []

    for alert_code in payload.alerts:
        alerts.append(
            {
                "severity": "warning",
                "code": alert_code,
                "message": f"External alert received: {alert_code}",
            }
        )

    return alerts


def deduplicate_alerts(alerts: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[tuple[str, str]] = set()
    result: list[dict[str, str]] = []

    for alert in alerts:
        key = (alert["severity"], alert["code"])
        if key not in seen:
            seen.add(key)
            result.append(alert)

    return result


def save_alerts(
    db: Session,
    locomotive_id: str,
    timestamp: datetime,
    alerts: list[dict[str, str]],
) -> None:
    for alert in alerts:
        db.add(
            AlertsHistory(
                locomotive_id=locomotive_id,
                timestamp=timestamp,
                severity=alert["severity"],
                code=alert["code"],
                message=alert["message"],
            )
        )


def build_alert_codes(existing_codes: list[str], generated_alerts: list[dict[str, str]]) -> list[str]:
    codes = list(existing_codes)

    for alert in generated_alerts:
        if alert["code"] not in codes:
            codes.append(alert["code"])

    return codes


def generate_and_save_alerts(payload: TelemetryIn, db: Session) -> list[dict[str, str]]:
    threshold_alerts = generate_threshold_alerts(payload, db)
    payload_alerts = generate_payload_alerts(payload)

    all_alerts = deduplicate_alerts(threshold_alerts + payload_alerts)
    save_alerts(db, payload.locomotive_id, payload.timestamp, all_alerts)

    return all_alerts