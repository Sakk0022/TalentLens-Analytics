from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.schemas.alert import AlertItem


LocomotiveType = Literal["KZ8A", "TE33A"]


class TelemetryIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    locomotive_id: str = Field(..., min_length=1, max_length=100)
    locomotive_type: LocomotiveType
    timestamp: datetime

    scenario: str | None = None
    step: int | None = None

    speed_kmh: float = Field(..., ge=0, le=400)
    fuel_liters: float | None = Field(default=None, ge=0)
    # Accept incoming payloads that use either `resource_level` or `fuel_percent`.
    # Serialize/store under `fuel_percent` while allowing `resource_level` from simulator.
    fuel_percent: float | None = Field(default=None, ge=0, le=100, alias='resource_level')
    rpm: int | None = Field(default=None, ge=0, le=10000)

    engine_temp_c: float | None = Field(default=None, ge=-50, le=300)
    exhaust_temp_c: float | None = Field(default=None, ge=-50, le=1000)
    oil_temp_c: float | None = Field(default=None, ge=-50, le=300)

    # Accept incoming payloads that use either `pressure_bar` or `oil_pressure_bar`.
    # Serialize using the alias `pressure_bar` for consistency with frontend.
    oil_pressure_bar: float | None = Field(default=None, ge=0, le=50, alias='pressure_bar')
    brake_pressure_bar: float | None = Field(default=None, ge=0, le=50)
    compressor_bar: float | None = Field(default=None, ge=0, le=50)
    voltage_aux_v: float | None = Field(default=None, ge=0, le=500)

    alerts: list[AlertItem] = Field(default_factory=list)

    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)

    @field_validator("locomotive_type", mode="before")
    @classmethod
    def normalize_locomotive_type(cls, value):
        return str(value).upper()


class TelemetryOut(TelemetryIn):
    id: int