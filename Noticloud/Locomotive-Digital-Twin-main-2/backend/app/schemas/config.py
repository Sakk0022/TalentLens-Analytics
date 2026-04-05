from typing import Any, Literal

from pydantic import BaseModel, Field


Direction = Literal["high", "low"]


class ParamConfigResponse(BaseModel):
    parameter: str
    label: str
    unit: str
    direction: Direction
    norm: list[float]
    warning: list[float]
    critical: list[float]
    penalty_warn: int = Field(..., ge=0)
    penalty_crit: int = Field(..., ge=0)
    alert_code: str
    alert_msg: str
    recommend_warn: str
    recommend_crit: str


class ProfileConfigResponse(BaseModel):
    locomotive_type: str
    name: str
    type: str
    resource_type: str
    resource_unit: str | None = None
    max_speed_kmh: float | int | None = None
    description: str | None = None
    params: list[ParamConfigResponse]
    alert_penalties: dict[str, int]
    health_categories: dict[str, dict[str, Any]]


class ProfilesResponse(BaseModel):
    profiles: list[ProfileConfigResponse]


class ParamConfigUpdateRequest(BaseModel):
    label: str | None = None
    unit: str | None = None
    direction: Direction | None = None
    norm: list[float] | None = None
    warning: list[float] | None = None
    critical: list[float] | None = None
    penalty_warn: int | None = Field(default=None, ge=0)
    penalty_crit: int | None = Field(default=None, ge=0)
    alert_code: str | None = None
    alert_msg: str | None = None
    recommend_warn: str | None = None
    recommend_crit: str | None = None