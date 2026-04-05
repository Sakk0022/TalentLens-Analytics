from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TelemetryHistory(Base):
    __tablename__ = "telemetry_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    locomotive_id: Mapped[str] = mapped_column(String(100), index=True)
    locomotive_type: Mapped[str] = mapped_column(String(20), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    scenario: Mapped[str | None] = mapped_column(String(50), nullable=True)
    step: Mapped[int | None] = mapped_column(Integer, nullable=True)

    speed_kmh: Mapped[float] = mapped_column(Float)
    fuel_liters: Mapped[float | None] = mapped_column(Float, nullable=True)
    fuel_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    rpm: Mapped[int | None] = mapped_column(Integer, nullable=True)

    engine_temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    exhaust_temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    oil_temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)

    oil_pressure_bar: Mapped[float | None] = mapped_column(Float, nullable=True)
    brake_pressure_bar: Mapped[float | None] = mapped_column(Float, nullable=True)
    compressor_bar: Mapped[float | None] = mapped_column(Float, nullable=True)
    voltage_aux_v: Mapped[float | None] = mapped_column(Float, nullable=True)

    alerts_json: Mapped[str] = mapped_column(Text)

    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)


class HealthHistory(Base):
    __tablename__ = "health_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    locomotive_id: Mapped[str] = mapped_column(String(100), index=True)
    locomotive_type: Mapped[str] = mapped_column(String(20), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    health_index: Mapped[float] = mapped_column(Float)
    health_status: Mapped[str] = mapped_column(String(20))
    factors_json: Mapped[str] = mapped_column(Text)
    top_factors_json: Mapped[str] = mapped_column(Text)
    recommendation: Mapped[str] = mapped_column(Text)


class AlertsHistory(Base):
    __tablename__ = "alerts_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    locomotive_id: Mapped[str] = mapped_column(String(100), index=True)
    locomotive_type: Mapped[str] = mapped_column(String(20), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    severity: Mapped[str] = mapped_column(String(20), index=True)
    code: Mapped[str] = mapped_column(String(100), index=True)

    param: Mapped[str | None] = mapped_column(String(100), nullable=True)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)

    message: Mapped[str] = mapped_column(Text)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)


class ProfileConfig(Base):
    __tablename__ = "profile_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    locomotive_type: Mapped[str] = mapped_column(String(20), index=True)
    parameter: Mapped[str] = mapped_column(String(100), index=True)

    label: Mapped[str] = mapped_column(String(200))
    unit: Mapped[str] = mapped_column(String(50))
    direction: Mapped[str] = mapped_column(String(20))

    norm_min: Mapped[float] = mapped_column(Float)
    norm_max: Mapped[float] = mapped_column(Float)
    warning_min: Mapped[float] = mapped_column(Float)
    warning_max: Mapped[float] = mapped_column(Float)
    critical_min: Mapped[float] = mapped_column(Float)
    critical_max: Mapped[float] = mapped_column(Float)

    penalty_warn: Mapped[int] = mapped_column(Integer)
    penalty_crit: Mapped[int] = mapped_column(Integer)

    alert_code: Mapped[str] = mapped_column(String(100))
    alert_msg: Mapped[str] = mapped_column(Text)
    recommend_warn: Mapped[str] = mapped_column(Text)
    recommend_crit: Mapped[str] = mapped_column(Text)