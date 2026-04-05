from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AlertsHistory
from app.db.session import get_db
from app.schemas.alert import AlertHistoryResponse

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("", response_model=list[AlertHistoryResponse])
def get_alerts(
    locomotive_id: str | None = Query(default=None),
    locomotive_type: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    from_dt: datetime | None = Query(default=None),
    to_dt: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[AlertHistoryResponse]:
    query = select(AlertsHistory)

    if locomotive_id:
        query = query.where(AlertsHistory.locomotive_id == locomotive_id)

    if locomotive_type:
        query = query.where(AlertsHistory.locomotive_type == locomotive_type.upper())

    if severity:
        query = query.where(AlertsHistory.severity == severity.upper())

    if from_dt:
        query = query.where(AlertsHistory.timestamp >= from_dt)

    if to_dt:
        query = query.where(AlertsHistory.timestamp <= to_dt)

    rows = db.execute(
        query.order_by(AlertsHistory.timestamp.desc()).offset(offset).limit(limit)
    ).scalars().all()

    return [
        AlertHistoryResponse(
            id=row.id,
            locomotive_id=row.locomotive_id,
            locomotive_type=row.locomotive_type,
            timestamp=row.timestamp,
            code=row.code,
            severity=row.severity,
            msg=row.message,
            recommend=row.recommendation,
            param=row.param,
            value=row.value,
            unit=row.unit,
        )
        for row in rows
    ]