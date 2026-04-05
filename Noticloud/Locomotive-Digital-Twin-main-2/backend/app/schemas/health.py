from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


HealthStatus = Literal["NORM", "WARNING", "CRITICAL"]


class HealthFactorItem(BaseModel):
    param: str
    label: str
    value: float | int | str | None = None
    unit: str | None = None
    status: HealthStatus
    penalty: float


class HealthResponse(BaseModel):
    id: int
    locomotive_id: str
    locomotive_type: str
    timestamp: datetime
    health_index: float = Field(..., ge=0, le=100)
    health_status: HealthStatus
    factors: list[HealthFactorItem]
    top_factors: list[HealthFactorItem]
    recommendation: str