from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.rate_limit import build_rate_limit_dependency
from app.core.security import verify_admin_access
from app.core.settings import settings
from app.db.models import ProfileConfig
from app.db.session import get_db
from app.profiles import BASE_PROFILES
from app.schemas.config import (
    ParamConfigResponse,
    ParamConfigUpdateRequest,
    ProfileConfigResponse,
    ProfilesResponse,
)
from app.services.profile_service import get_all_profiles, get_profile

router = APIRouter(prefix="/api/config", tags=["Config"])

admin_rate_limit = build_rate_limit_dependency(
    scope_name="admin_config_update",
    limit=settings.admin_rate_limit,
    window_seconds=settings.admin_rate_window_seconds,
)


def profile_to_response(profile: dict) -> ProfileConfigResponse:
    params = [
        ParamConfigResponse(
            parameter=param_name,
            label=cfg["label"],
            unit=cfg["unit"],
            direction=cfg["direction"],
            norm=cfg["norm"],
            warning=cfg["warning"],
            critical=cfg["critical"],
            penalty_warn=cfg["penalty_warn"],
            penalty_crit=cfg["penalty_crit"],
            alert_code=cfg["alert_code"],
            alert_msg=cfg["alert_msg"],
            recommend_warn=cfg["recommend_warn"],
            recommend_crit=cfg["recommend_crit"],
        )
        for param_name, cfg in profile["params"].items()
    ]

    return ProfileConfigResponse(
        locomotive_type=profile["id"],
        name=profile["name"],
        type=profile["type"],
        resource_type=profile["resource_type"],
        resource_unit=profile.get("resource_unit"),
        max_speed_kmh=profile.get("max_speed_kmh"),
        description=profile.get("description"),
        params=params,
        alert_penalties=profile["alert_penalties"],
        health_categories=profile["health_categories"],
    )


@router.get("", response_model=ProfilesResponse)
def get_config(
    locomotive_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> ProfilesResponse:
    if locomotive_type:
        profile = get_profile(locomotive_type, db)
        return ProfilesResponse(profiles=[profile_to_response(profile)])

    profiles = get_all_profiles(db)
    return ProfilesResponse(profiles=[profile_to_response(p) for p in profiles])


@router.put(
    "/{locomotive_type}/{parameter}",
    response_model=ParamConfigResponse,
    dependencies=[Depends(verify_admin_access), Depends(admin_rate_limit)],
)
def update_config_item(
    locomotive_type: str,
    parameter: str,
    payload: ParamConfigUpdateRequest,
    db: Session = Depends(get_db),
) -> ParamConfigResponse:
    loco_type = locomotive_type.upper()

    if loco_type not in BASE_PROFILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown locomotive profile",
        )

    row = db.execute(
        select(ProfileConfig).where(
            ProfileConfig.locomotive_type == loco_type,
            ProfileConfig.parameter == parameter,
        )
    ).scalars().first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile config item not found",
        )

    if payload.label is not None:
        row.label = payload.label
    if payload.unit is not None:
        row.unit = payload.unit
    if payload.direction is not None:
        row.direction = payload.direction
    if payload.norm is not None:
        row.norm_min = payload.norm[0]
        row.norm_max = payload.norm[1]
    if payload.warning is not None:
        row.warning_min = payload.warning[0]
        row.warning_max = payload.warning[1]
    if payload.critical is not None:
        row.critical_min = payload.critical[0]
        row.critical_max = payload.critical[1]
    if payload.penalty_warn is not None:
        row.penalty_warn = payload.penalty_warn
    if payload.penalty_crit is not None:
        row.penalty_crit = payload.penalty_crit
    if payload.alert_code is not None:
        row.alert_code = payload.alert_code
    if payload.alert_msg is not None:
        row.alert_msg = payload.alert_msg
    if payload.recommend_warn is not None:
        row.recommend_warn = payload.recommend_warn
    if payload.recommend_crit is not None:
        row.recommend_crit = payload.recommend_crit

    db.commit()
    db.refresh(row)

    return ParamConfigResponse(
        parameter=row.parameter,
        label=row.label,
        unit=row.unit,
        direction=row.direction,
        norm=[row.norm_min, row.norm_max],
        warning=[row.warning_min, row.warning_max],
        critical=[row.critical_min, row.critical_max],
        penalty_warn=row.penalty_warn,
        penalty_crit=row.penalty_crit,
        alert_code=row.alert_code,
        alert_msg=row.alert_msg,
        recommend_warn=row.recommend_warn,
        recommend_crit=row.recommend_crit,
    )