import json
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import HealthHistory
from app.db.session import get_db
from app.schemas.health import HealthFactorItem, HealthResponse

router = APIRouter(prefix="/api/health", tags=["Health"])


@router.get("", response_model=list[HealthResponse])
def get_health_history(
    locomotive_id: str | None = Query(default=None),
    locomotive_type: str | None = Query(default=None),
    health_status: str | None = Query(default=None),
    from_dt: datetime | None = Query(default=None),
    to_dt: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[HealthResponse]:
    query = select(HealthHistory)

    if locomotive_id:
        query = query.where(HealthHistory.locomotive_id == locomotive_id)

    if locomotive_type:
        query = query.where(HealthHistory.locomotive_type == locomotive_type.upper())

    if health_status:
        query = query.where(HealthHistory.health_status == health_status.upper())

    if from_dt:
        query = query.where(HealthHistory.timestamp >= from_dt)

    if to_dt:
        query = query.where(HealthHistory.timestamp <= to_dt)

    rows = db.execute(
        query.order_by(HealthHistory.timestamp.desc()).offset(offset).limit(limit)
    ).scalars().all()

    return [
        HealthResponse(
            id=row.id,
            locomotive_id=row.locomotive_id,
            locomotive_type=row.locomotive_type,
            timestamp=row.timestamp,
            health_index=row.health_index,
            health_status=row.health_status,
            factors=[HealthFactorItem.model_validate(item) for item in json.loads(row.factors_json)],
            top_factors=[HealthFactorItem.model_validate(item) for item in json.loads(row.top_factors_json)],
            recommendation=row.recommendation,
        )
        for row in rows
    ]