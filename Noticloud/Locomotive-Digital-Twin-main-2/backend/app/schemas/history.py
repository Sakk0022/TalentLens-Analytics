from datetime import datetime
from typing import Literal

from pydantic import BaseModel


HistoryEventType = Literal["alert", "health_transition"]


class ReplayEventResponse(BaseModel):
    timestamp: datetime
    locomotive_id: str
    locomotive_type: str
    step: int | None = None
    event_type: HistoryEventType
    severity: str
    title: str
    details: str | None = None