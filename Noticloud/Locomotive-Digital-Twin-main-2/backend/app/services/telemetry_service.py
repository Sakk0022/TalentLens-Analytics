import json

from sqlalchemy.orm import Session

from app.db.models import AlertsHistory, HealthHistory, TelemetryHistory
from app.profiles.profile_checker import check_telemetry
from app.schemas.alert import AlertItem
from app.schemas.telemetry import TelemetryIn, TelemetryOut
from app.services.dedup_service import build_existing_health_result, find_duplicate_telemetry
from app.services.profile_service import get_profile


def process_telemetry(payload: TelemetryIn, db: Session) -> tuple[TelemetryOut, dict, bool]:
    existing = find_duplicate_telemetry(payload, db)
    if existing is not None:
        existing_health = build_existing_health_result(existing, db)
        return telemetry_row_to_response(existing), existing_health, True

    profile = get_profile(payload.locomotive_type, db)

    packet = payload.model_dump(mode="python")
    packet["alerts"] = [alert.model_dump() for alert in payload.alerts]

    result = check_telemetry(packet, profile)

    telemetry_row = TelemetryHistory(
        locomotive_id=payload.locomotive_id,
        locomotive_type=payload.locomotive_type,
        timestamp=payload.timestamp,
        scenario=payload.scenario,
        step=payload.step,
        speed_kmh=payload.speed_kmh,
        fuel_liters=payload.fuel_liters,
        fuel_percent=payload.fuel_percent,
        rpm=payload.rpm,
        engine_temp_c=payload.engine_temp_c,
        exhaust_temp_c=payload.exhaust_temp_c,
        oil_temp_c=payload.oil_temp_c,
        oil_pressure_bar=payload.oil_pressure_bar,
        brake_pressure_bar=payload.brake_pressure_bar,
        compressor_bar=payload.compressor_bar,
        voltage_aux_v=payload.voltage_aux_v,
        alerts_json=json.dumps(result["alerts"], ensure_ascii=False),
        lat=payload.lat,
        lon=payload.lon,
    )

    health_row = HealthHistory(
        locomotive_id=payload.locomotive_id,
        locomotive_type=payload.locomotive_type,
        timestamp=payload.timestamp,
        health_index=result["health_index"],
        health_status=result["health_status"],
        factors_json=json.dumps(result["factors"], ensure_ascii=False),
        top_factors_json=json.dumps(result["top_factors"], ensure_ascii=False),
        recommendation=result["recommendation"],
    )

    db.add(telemetry_row)
    db.add(health_row)

    for alert in result["alerts"]:
        db.add(
            AlertsHistory(
                locomotive_id=payload.locomotive_id,
                locomotive_type=payload.locomotive_type,
                timestamp=payload.timestamp,
                severity=str(alert.get("severity", "INFO")).upper(),
                code=alert.get("code", "UNKNOWN"),
                param=alert.get("param"),
                value=alert.get("value"),
                unit=alert.get("unit"),
                message=alert.get("msg", ""),
                recommendation=alert.get("recommend"),
            )
        )

    db.commit()
    db.refresh(telemetry_row)
    db.refresh(health_row)

    return telemetry_row_to_response(telemetry_row), result, False


def telemetry_row_to_response(row: TelemetryHistory) -> TelemetryOut:
    alerts = json.loads(row.alerts_json) if row.alerts_json else []
    alerts = [AlertItem.model_validate(item) for item in alerts]

    return TelemetryOut(
        id=row.id,
        locomotive_id=row.locomotive_id,
        locomotive_type=row.locomotive_type,
        timestamp=row.timestamp,
        scenario=row.scenario,
        step=row.step,
        speed_kmh=row.speed_kmh,
        fuel_liters=row.fuel_liters,
        fuel_percent=row.fuel_percent,
        rpm=row.rpm,
        engine_temp_c=row.engine_temp_c,
        exhaust_temp_c=row.exhaust_temp_c,
        oil_temp_c=row.oil_temp_c,
        oil_pressure_bar=row.oil_pressure_bar,
        brake_pressure_bar=row.brake_pressure_bar,
        compressor_bar=row.compressor_bar,
        voltage_aux_v=row.voltage_aux_v,
        alerts=alerts,
        lat=row.lat,
        lon=row.lon,
    )


def build_live_message(telemetry: TelemetryOut, health_result: dict) -> dict:
    return {
        "type": "telemetry_update",
        "data": {
            "telemetry": telemetry.model_dump(mode="json"),
            "health": {
                "health_index": health_result["health_index"],
                "health_status": health_result["health_status"],
                "factors": health_result["factors"],
                "top_factors": health_result["top_factors"],
                "recommendation": health_result["recommendation"],
            },
            "alerts": health_result["alerts"],
        },
    }