import csv
import io
import json
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import HealthHistory, TelemetryHistory
from app.db.session import get_db

router = APIRouter(prefix="/api/report", tags=["Report"])

SortOrder = Literal["asc", "desc"]


def fetch_report_rows(
    db: Session,
    locomotive_id: str | None = None,
    locomotive_type: str | None = None,
    scenario: str | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    order: SortOrder = "desc",
    limit: int = 1000,
):
    telemetry_query = select(TelemetryHistory)

    if locomotive_id:
        telemetry_query = telemetry_query.where(TelemetryHistory.locomotive_id == locomotive_id)

    if locomotive_type:
        telemetry_query = telemetry_query.where(TelemetryHistory.locomotive_type == locomotive_type.upper())

    if scenario:
        telemetry_query = telemetry_query.where(TelemetryHistory.scenario == scenario)

    if from_dt:
        telemetry_query = telemetry_query.where(TelemetryHistory.timestamp >= from_dt)

    if to_dt:
        telemetry_query = telemetry_query.where(TelemetryHistory.timestamp <= to_dt)

    if order == "asc":
        telemetry_query = telemetry_query.order_by(TelemetryHistory.timestamp.asc())
    else:
        telemetry_query = telemetry_query.order_by(TelemetryHistory.timestamp.desc())

    telemetry_rows = db.execute(telemetry_query.limit(limit)).scalars().all()

    health_query = select(HealthHistory)

    if locomotive_id:
        health_query = health_query.where(HealthHistory.locomotive_id == locomotive_id)

    if locomotive_type:
        health_query = health_query.where(HealthHistory.locomotive_type == locomotive_type.upper())

    if from_dt:
        health_query = health_query.where(HealthHistory.timestamp >= from_dt)

    if to_dt:
        health_query = health_query.where(HealthHistory.timestamp <= to_dt)

    health_rows = db.execute(health_query).scalars().all()
    health_map = {(row.locomotive_id, row.timestamp): row for row in health_rows}

    result_rows = []

    for row in telemetry_rows:
        health_row = health_map.get((row.locomotive_id, row.timestamp))

        alerts = json.loads(row.alerts_json) if row.alerts_json else []
        top_factors = []
        health_index = None
        health_status = None
        recommendation = None

        if health_row:
            top_factors = json.loads(health_row.top_factors_json)
            health_index = health_row.health_index
            health_status = health_row.health_status
            recommendation = health_row.recommendation

        result_rows.append(
            {
                "id": row.id,
                "timestamp": row.timestamp.isoformat(),
                "locomotive_id": row.locomotive_id,
                "locomotive_type": row.locomotive_type,
                "scenario": row.scenario,
                "step": row.step,
                "speed_kmh": row.speed_kmh,
                "fuel_liters": row.fuel_liters,
                "fuel_percent": row.fuel_percent,
                "rpm": row.rpm,
                "engine_temp_c": row.engine_temp_c,
                "exhaust_temp_c": row.exhaust_temp_c,
                "oil_temp_c": row.oil_temp_c,
                "oil_pressure_bar": row.oil_pressure_bar,
                "brake_pressure_bar": row.brake_pressure_bar,
                "compressor_bar": row.compressor_bar,
                "voltage_aux_v": row.voltage_aux_v,
                "alerts": alerts,
                "lat": row.lat,
                "lon": row.lon,
                "health_index": health_index,
                "health_status": health_status,
                "top_factors": top_factors,
                "recommendation": recommendation,
            }
        )

    return result_rows


def build_filename(
    prefix: str,
    locomotive_id: str | None,
    locomotive_type: str | None,
    scenario: str | None,
    ext: str,
) -> str:
    parts = [prefix]
    if locomotive_type:
        parts.append(locomotive_type.upper())
    if locomotive_id:
        parts.append(locomotive_id)
    if scenario:
        parts.append(scenario)
    return "_".join(parts) + ext


@router.get("/csv")
def export_csv_report(
    locomotive_id: str | None = Query(default=None),
    locomotive_type: str | None = Query(default=None),
    scenario: str | None = Query(default=None),
    from_dt: datetime | None = Query(default=None),
    to_dt: datetime | None = Query(default=None),
    order: SortOrder = Query(default="desc"),
    limit: int = Query(default=1000, ge=1, le=10000),
    db: Session = Depends(get_db),
):
    rows = fetch_report_rows(
        db=db,
        locomotive_id=locomotive_id,
        locomotive_type=locomotive_type,
        scenario=scenario,
        from_dt=from_dt,
        to_dt=to_dt,
        order=order,
        limit=limit,
    )

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(
        [
            "id",
            "timestamp",
            "locomotive_id",
            "locomotive_type",
            "scenario",
            "step",
            "speed_kmh",
            "fuel_liters",
            "fuel_percent",
            "rpm",
            "engine_temp_c",
            "exhaust_temp_c",
            "oil_temp_c",
            "oil_pressure_bar",
            "brake_pressure_bar",
            "compressor_bar",
            "voltage_aux_v",
            "alerts",
            "lat",
            "lon",
            "health_index",
            "health_status",
            "top_factors",
            "recommendation",
        ]
    )

    for row in rows:
        writer.writerow(
            [
                row["id"],
                row["timestamp"],
                row["locomotive_id"],
                row["locomotive_type"],
                row["scenario"],
                row["step"],
                row["speed_kmh"],
                row["fuel_liters"],
                row["fuel_percent"],
                row["rpm"],
                row["engine_temp_c"],
                row["exhaust_temp_c"],
                row["oil_temp_c"],
                row["oil_pressure_bar"],
                row["brake_pressure_bar"],
                row["compressor_bar"],
                row["voltage_aux_v"],
                json.dumps(row["alerts"], ensure_ascii=False),
                row["lat"],
                row["lon"],
                row["health_index"],
                row["health_status"],
                json.dumps(row["top_factors"], ensure_ascii=False),
                row["recommendation"],
            ]
        )

    output.seek(0)

    filename = build_filename(
        prefix="locomotive_report",
        locomotive_id=locomotive_id,
        locomotive_type=locomotive_type,
        scenario=scenario,
        ext=".csv",
    )

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/pdf")
def export_pdf_report(
    locomotive_id: str | None = Query(default=None),
    locomotive_type: str | None = Query(default=None),
    scenario: str | None = Query(default=None),
    from_dt: datetime | None = Query(default=None),
    to_dt: datetime | None = Query(default=None),
    order: SortOrder = Query(default="desc"),
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    rows = fetch_report_rows(
        db=db,
        locomotive_id=locomotive_id,
        locomotive_type=locomotive_type,
        scenario=scenario,
        from_dt=from_dt,
        to_dt=to_dt,
        order=order,
        limit=limit,
    )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )

    styles = getSampleStyleSheet()
    elements = []

    title = "Locomotive Diagnostic Report"
    subtitle_parts = []
    if locomotive_type:
        subtitle_parts.append(f"type={locomotive_type.upper()}")
    if locomotive_id:
        subtitle_parts.append(f"id={locomotive_id}")
    if scenario:
        subtitle_parts.append(f"scenario={scenario}")

    subtitle_text = ", ".join(subtitle_parts) if subtitle_parts else "all data"

    elements.append(Paragraph(title, styles["Title"]))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(f"Filter: {subtitle_text}", styles["Normal"]))
    elements.append(Paragraph(f"Generated at: {datetime.utcnow().isoformat()} UTC", styles["Normal"]))
    elements.append(Spacer(1, 10))

    summary_table_data = [
        ["Metric", "Value"],
        ["Records", str(len(rows))],
        ["Locomotive Type", locomotive_type.upper() if locomotive_type else "ALL"],
        ["Locomotive ID", locomotive_id or "ALL"],
        ["Scenario", scenario or "ALL"],
    ]

    summary_table = Table(summary_table_data, colWidths=[55 * mm, 105 * mm])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D9E8F5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(summary_table)
    elements.append(Spacer(1, 12))

    detail_header = [
        "Time",
        "ID",
        "Type",
        "Scenario",
        "Speed",
        "Engine",
        "Oil P",
        "Health",
        "Status",
    ]
    detail_rows = [detail_header]

    for row in rows[:40]:
        detail_rows.append(
            [
                row["timestamp"][11:19],
                row["locomotive_id"],
                row["locomotive_type"],
                row["scenario"] or "-",
                str(row["speed_kmh"] if row["speed_kmh"] is not None else "-"),
                str(row["engine_temp_c"] if row["engine_temp_c"] is not None else "-"),
                str(row["oil_pressure_bar"] if row["oil_pressure_bar"] is not None else "-"),
                str(row["health_index"] if row["health_index"] is not None else "-"),
                row["health_status"] or "-",
            ]
        )

    col_widths = [22 * mm, 28 * mm, 18 * mm, 20 * mm, 16 * mm, 18 * mm, 16 * mm, 16 * mm, 18 * mm]
    detail_table = Table(detail_rows, colWidths=col_widths, repeatRows=1)
    detail_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EAF2F8")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (4, 1), (-1, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    elements.append(Paragraph("Telemetry Overview", styles["Heading2"]))
    elements.append(detail_table)
    elements.append(Spacer(1, 12))

    if rows:
        latest = rows[0]
        factors_text = json.dumps(latest["top_factors"], ensure_ascii=False)
        alerts_text = json.dumps(latest["alerts"], ensure_ascii=False)

        elements.append(Paragraph("Latest Record Diagnostics", styles["Heading2"]))
        elements.append(Paragraph(f"Recommendation: {latest['recommendation'] or '-'}", styles["Normal"]))
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(f"Top factors: {factors_text}", styles["Normal"]))
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(f"Alerts: {alerts_text}", styles["Normal"]))

    doc.build(elements)
    buffer.seek(0)

    filename = build_filename(
        prefix="locomotive_report",
        locomotive_id=locomotive_id,
        locomotive_type=locomotive_type,
        scenario=scenario,
        ext=".pdf",
    )

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )