import json
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import HealthHistory, ProfileConfig
from app.schemas.telemetry import TelemetryIn


PARAMETER_LABELS = {
    "speed_kmh": "Speed",
    "resource_level": "Resource level",
    "engine_temp_c": "Engine temperature",
    "oil_temp_c": "Oil temperature",
    "pressure_bar": "Pressure",
}


def calculate_health(payload: TelemetryIn, db: Session) -> dict:
    rows = db.execute(
        select(ProfileConfig).where(ProfileConfig.locomotive_type == payload.locomotive_type)
    ).scalars().all()

    total_penalty = 0.0
    top_factors: list[str] = []
    status = "normal"

    for row in rows:
        value = getattr(payload, row.parameter, None)
        if value is None:
            continue

        factor_penalty = 0.0
        label = PARAMETER_LABELS.get(row.parameter, row.parameter)

        # Critical zone
        if row.critical_min is not None and value < row.critical_min:
            diff = row.critical_min - value
            factor_penalty = 25.0 * row.weight + diff * row.weight
            status = "critical"
            top_factors.append(f"{label} critically low: {value}")

        elif row.critical_max is not None and value > row.critical_max:
            diff = value - row.critical_max
            factor_penalty = 25.0 * row.weight + diff * row.weight
            status = "critical"
            top_factors.append(f"{label} critically high: {value}")

        # Warning zone
        elif row.warning_min is not None and value < row.warning_min:
            diff = row.warning_min - value
            factor_penalty = 12.0 * row.weight + diff * row.weight
            if status != "critical":
                status = "warning"
            top_factors.append(f"{label} below normal: {value}")

        elif row.warning_max is not None and value > row.warning_max:
            diff = value - row.warning_max
            factor_penalty = 12.0 * row.weight + diff * row.weight
            if status != "critical":
                status = "warning"
            top_factors.append(f"{label} above normal: {value}")

        total_penalty += factor_penalty

    # External alert penalty
    if payload.alerts:
        total_penalty += min(len(payload.alerts) * 3.0, 15.0)
        if status == "normal":
            status = "warning"
        for alert_code in payload.alerts[:3]:
            top_factors.append(f"External alert active: {alert_code}")

    health_index = max(0.0, min(100.0, round(100.0 - total_penalty, 2)))

    if health_index < 60:
        status = "critical"
    elif health_index < 80 and status == "normal":
        status = "warning"

    recommendation = build_recommendation(status, top_factors)

    return {
        "health_index": health_index,
        "status": status,
        "top_factors": top_factors[:5],
        "recommendation": recommendation,
    }


def build_recommendation(status: str, top_factors: list[str]) -> str:
    if status == "critical":
        return "Immediate inspection recommended. Reduce load and check critical subsystems."
    if status == "warning":
        return "Monitor locomotive condition and inspect affected parameters."
    return "Locomotive condition is stable. Continue normal operation."


def save_health(
    db: Session,
    locomotive_id: str,
    timestamp: datetime,
    health_data: dict,
) -> None:
    db.add(
        HealthHistory(
            locomotive_id=locomotive_id,
            timestamp=timestamp,
            health_index=health_data["health_index"],
            status=health_data["status"],
            top_factors_json=json.dumps(health_data["top_factors"], ensure_ascii=False),
            recommendation=health_data["recommendation"],
        )
    )