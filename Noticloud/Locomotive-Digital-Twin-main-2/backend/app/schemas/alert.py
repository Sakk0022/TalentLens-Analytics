from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


AlertSeverity = Literal["INFO", "WARNING", "CRITICAL"]


class AlertItem(BaseModel):
    code: str = Field(..., min_length=1, max_length=100)
    severity: AlertSeverity = "INFO"
    msg: str = Field(default="")
    recommend: str | None = None
    param: str | None = None
    value: float | None = None
    unit: str | None = None

    @field_validator("severity", mode="before")
    @classmethod
    def normalize_severity(cls, value):
        return str(value).upper()


class AlertHistoryResponse(AlertItem):
    id: int
    locomotive_id: str
    locomotive_type: str
    timestamp: datetime