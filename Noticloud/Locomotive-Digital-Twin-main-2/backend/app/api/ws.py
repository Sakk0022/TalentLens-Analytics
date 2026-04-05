import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.core.metrics import (
    INGEST_ERRORS_TOTAL,
    INGEST_REQUESTS_TOTAL,
    WS_SIMULATOR_MESSAGES_TOTAL,
    WS_SIMULATOR_RATE_LIMIT_TOTAL,
)
from app.core.rate_limit import rate_limiter
from app.core.settings import settings
from app.db.session import SessionLocal
from app.schemas.telemetry import TelemetryIn
from app.services.live_service import manager
from app.services.telemetry_service import build_live_message, process_telemetry

logger = logging.getLogger("app.ws")

router = APIRouter(tags=["WebSocket"])


def get_ws_client_ip(websocket: WebSocket) -> str:
    if websocket.client:
        return websocket.client.host
    return "unknown"


@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket) -> None:
    await manager.connect(websocket)

    try:
        await manager.send_personal_message(
            websocket,
            {
                "type": "connection_status",
                "status": "connected",
                "message": "WebSocket connection established",
            },
        )

        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


@router.websocket("/ws/simulator")
async def websocket_simulator(websocket: WebSocket) -> None:
    await websocket.accept()
    db = SessionLocal()
    client_ip = get_ws_client_ip(websocket)

    try:
        await websocket.send_json(
            {
                "type": "connection_status",
                "status": "connected",
                "message": "Simulator WebSocket connected",
            }
        )

        while True:
            allowed, retry_after = rate_limiter.hit(
                key=f"ws_simulator:{client_ip}",
                limit=settings.ws_simulator_rate_limit,
                window_seconds=settings.ws_simulator_rate_window_seconds,
            )

            if not allowed:
                WS_SIMULATOR_RATE_LIMIT_TOTAL.inc()
                await websocket.send_json(
                    {
                        "type": "error",
                        "status": "rate_limited",
                        "detail": f"Rate limit exceeded. Try again in {retry_after}s.",
                    }
                )
                continue

            raw_message = await websocket.receive_text()
            WS_SIMULATOR_MESSAGES_TOTAL.inc()

            try:
                payload_dict = json.loads(raw_message)
                payload = TelemetryIn.model_validate(payload_dict)

                telemetry, health_result, was_duplicate = process_telemetry(payload, db)

                INGEST_REQUESTS_TOTAL.labels(
                    transport="websocket",
                    locomotive_type=payload.locomotive_type,
                ).inc()

                if not was_duplicate:
                    await manager.broadcast(build_live_message(telemetry, health_result))

                await websocket.send_json(
                    {
                        "type": "ack",
                        "status": "ok",
                        "duplicate": was_duplicate,
                        "telemetry_id": telemetry.id,
                        "health_index": health_result["health_index"],
                        "health_status": health_result["health_status"],
                    }
                )

            except ValidationError as e:
                INGEST_ERRORS_TOTAL.labels(
                    transport="websocket",
                    error_type="validation_error",
                ).inc()
                await websocket.send_json(
                    {
                        "type": "error",
                        "status": "validation_error",
                        "detail": e.errors(),
                    }
                )
            except Exception as e:
                INGEST_ERRORS_TOTAL.labels(
                    transport="websocket",
                    error_type="processing_error",
                ).inc()
                logger.exception("Simulator websocket processing error")
                await websocket.send_json(
                    {
                        "type": "error",
                        "status": "server_error",
                        "detail": str(e),
                    }
                )

    except WebSocketDisconnect:
        logger.info("Simulator websocket disconnected")
    finally:
        db.close()