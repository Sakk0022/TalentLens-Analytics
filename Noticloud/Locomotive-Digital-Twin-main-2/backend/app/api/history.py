from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AlertsHistory, HealthHistory, TelemetryHistory
from app.db.session import get_db
from app.schemas.history import ReplayEventResponse
from app.schemas.telemetry import TelemetryOut
from app.services.telemetry_service import telemetry_row_to_response

router = APIRouter(prefix="/api/history", tags=["History"])

SortOrder = Literal["asc", "desc"]


@router.get("", response_model=list[TelemetryOut])
def get_history(
    locomotive_id: str | None = Query(default=None),
    locomotive_type: str | None = Query(default=None),
    scenario: str | None = Query(default=None),
    from_dt: datetime | None = Query(default=None),
    to_dt: datetime | None = Query(default=None),
    order: SortOrder = Query(default="desc"),
    limit: int = Query(default=100, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[TelemetryOut]:
    query = select(TelemetryHistory)

    if locomotive_id:
        query = query.where(TelemetryHistory.locomotive_id == locomotive_id)

    if locomotive_type:
        query = query.where(TelemetryHistory.locomotive_type == locomotive_type.upper())

    if scenario:
        query = query.where(TelemetryHistory.scenario == scenario)

    if from_dt:
        query = query.where(TelemetryHistory.timestamp >= from_dt)

    if to_dt:
        query = query.where(TelemetryHistory.timestamp <= to_dt)

    if order == "asc":
        query = query.order_by(TelemetryHistory.timestamp.asc())
    else:
        query = query.order_by(TelemetryHistory.timestamp.desc())

    rows = db.execute(query.offset(offset).limit(limit)).scalars().all()
    return [telemetry_row_to_response(row) for row in rows]


@router.get("/replay", response_model=list[TelemetryOut])
def replay_history(
    locomotive_id: str | None = Query(default=None),
    locomotive_type: str | None = Query(default=None),
    scenario: str | None = Query(default=None),
    minutes: int = Query(default=15, ge=1, le=1440),
    limit: int = Query(default=1000, ge=1, le=10000),
    db: Session = Depends(get_db),
) -> list[TelemetryOut]:
    now_utc = datetime.now(timezone.utc)
    from_dt = now_utc - timedelta(minutes=minutes)

    query = select(TelemetryHistory).where(TelemetryHistory.timestamp >= from_dt)

    if locomotive_id:
        query = query.where(TelemetryHistory.locomotive_id == locomotive_id)

    if locomotive_type:
        query = query.where(TelemetryHistory.locomotive_type == locomotive_type.upper())

    if scenario:
        query = query.where(TelemetryHistory.scenario == scenario)

    rows = db.execute(
        query.order_by(TelemetryHistory.timestamp.asc()).limit(limit)
    ).scalars().all()

    return [telemetry_row_to_response(row) for row in rows]


@router.get("/events", response_model=list[ReplayEventResponse])
def get_history_events(
    locomotive_id: str | None = Query(default=None),
    locomotive_type: str | None = Query(default=None),
    from_dt: datetime | None = Query(default=None),
    to_dt: datetime | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
    db: Session = Depends(get_db),
) -> list[ReplayEventResponse]:
    alerts_query = select(AlertsHistory)
    health_query = select(HealthHistory)

    if locomotive_id:
        alerts_query = alerts_query.where(AlertsHistory.locomotive_id == locomotive_id)
        health_query = health_query.where(HealthHistory.locomotive_id == locomotive_id)

    if locomotive_type:
        alerts_query = alerts_query.where(AlertsHistory.locomotive_type == locomotive_type.upper())
        health_query = health_query.where(HealthHistory.locomotive_type == locomotive_type.upper())

    if from_dt:
        alerts_query = alerts_query.where(AlertsHistory.timestamp >= from_dt)
        health_query = health_query.where(HealthHistory.timestamp >= from_dt)

    if to_dt:
        alerts_query = alerts_query.where(AlertsHistory.timestamp <= to_dt)
        health_query = health_query.where(HealthHistory.timestamp <= to_dt)

    alert_rows = db.execute(
        alerts_query.order_by(AlertsHistory.timestamp.asc()).limit(limit)
    ).scalars().all()

    health_rows = db.execute(
        health_query.order_by(HealthHistory.timestamp.asc()).limit(limit)
    ).scalars().all()

    events: list[ReplayEventResponse] = []

    for row in alert_rows:
        events.append(
            ReplayEventResponse(
                timestamp=row.timestamp,
                locomotive_id=row.locomotive_id,
                locomotive_type=row.locomotive_type,
                step=None,
                event_type="alert",
                severity=row.severity,
                title=row.code,
                details=row.message,
            )
        )

    prev_status_by_loco: dict[tuple[str, str], str] = {}

    for row in health_rows:
        key = (row.locomotive_id, row.locomotive_type)
        prev_status = prev_status_by_loco.get(key)

        if prev_status is None:
            prev_status_by_loco[key] = row.health_status
            continue

        if prev_status != row.health_status:
            events.append(
                ReplayEventResponse(
                    timestamp=row.timestamp,
                    locomotive_id=row.locomotive_id,
                    locomotive_type=row.locomotive_type,
                    step=None,
                    event_type="health_transition",
                    severity=row.health_status,
                    title=f"Health status changed to {row.health_status}",
                    details=f"health_index={row.health_index}",
                )
            )
            prev_status_by_loco[key] = row.health_status

    events.sort(key=lambda x: x.timestamp)
    return events[:limit]