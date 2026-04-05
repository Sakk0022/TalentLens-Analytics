import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import HealthHistory, TelemetryHistory


def find_duplicate_telemetry(packet, db: Session) -> TelemetryHistory | None:
    query = select(TelemetryHistory).where(
        TelemetryHistory.locomotive_id == packet.locomotive_id,
        TelemetryHistory.locomotive_type == packet.locomotive_type,
        TelemetryHistory.timestamp == packet.timestamp,
    )

    if packet.step is not None:
        query = query.where(TelemetryHistory.step == packet.step)

    return db.execute(query.limit(1)).scalars().first()


def build_existing_health_result(telemetry_row: TelemetryHistory, db: Session) -> dict:
    health_row = db.execute(
        select(HealthHistory).where(
            HealthHistory.locomotive_id == telemetry_row.locomotive_id,
            HealthHistory.locomotive_type == telemetry_row.locomotive_type,
            HealthHistory.timestamp == telemetry_row.timestamp,
        ).limit(1)
    ).scalars().first()

    alerts = json.loads(telemetry_row.alerts_json) if telemetry_row.alerts_json else []

    if health_row is None:
        return {
            "health_index": 100.0,
            "health_status": "NORM",
            "factors": [],
            "top_factors": [],
            "recommendation": "Health record not found for duplicate packet.",
            "alerts": alerts,
        }

    return {
        "health_index": health_row.health_index,
        "health_status": health_row.health_status,
        "factors": json.loads(health_row.factors_json),
        "top_factors": json.loads(health_row.top_factors_json),
        "recommendation": health_row.recommendation,
        "alerts": alerts,
    }