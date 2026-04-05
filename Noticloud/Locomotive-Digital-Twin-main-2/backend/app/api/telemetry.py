from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.metrics import INGEST_ERRORS_TOTAL, INGEST_REQUESTS_TOTAL
from app.core.rate_limit import build_rate_limit_dependency
from app.core.settings import settings
from app.db.session import get_db
from app.schemas.telemetry import TelemetryIn, TelemetryOut
from app.services.live_service import manager
from app.services.telemetry_service import build_live_message, process_telemetry

router = APIRouter(prefix="/api/telemetry", tags=["Telemetry"])

ingest_rate_limit = build_rate_limit_dependency(
    scope_name="telemetry_ingest",
    limit=settings.ingest_rate_limit,
    window_seconds=settings.ingest_rate_window_seconds,
)


@router.post(
    "/ingest",
    response_model=TelemetryOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(ingest_rate_limit)],
)
async def ingest_telemetry(
    payload: TelemetryIn,
    response: Response,
    db: Session = Depends(get_db),
) -> TelemetryOut:
    try:
        telemetry, health_result, was_duplicate = process_telemetry(payload, db)

        INGEST_REQUESTS_TOTAL.labels(
            transport="http",
            locomotive_type=payload.locomotive_type,
        ).inc()

        if was_duplicate:
            response.status_code = status.HTTP_200_OK
        else:
            await manager.broadcast(build_live_message(telemetry, health_result))

        return telemetry

    except Exception:
        INGEST_ERRORS_TOTAL.labels(
            transport="http",
            error_type="processing_error",
        ).inc()
        raise