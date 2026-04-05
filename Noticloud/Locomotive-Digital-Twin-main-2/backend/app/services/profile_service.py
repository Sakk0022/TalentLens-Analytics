from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ProfileConfig
from app.profiles import BASE_PROFILES


def seed_profile_config(db: Session) -> None:
    existing = db.execute(select(ProfileConfig)).scalars().first()
    if existing is not None:
        return

    for loco_type, profile in BASE_PROFILES.items():
        for parameter, cfg in profile["params"].items():
            db.add(
                ProfileConfig(
                    locomotive_type=loco_type,
                    parameter=parameter,
                    label=cfg["label"],
                    unit=cfg["unit"],
                    direction=cfg["direction"],
                    norm_min=cfg["norm"][0],
                    norm_max=cfg["norm"][1],
                    warning_min=cfg["warning"][0],
                    warning_max=cfg["warning"][1],
                    critical_min=cfg["critical"][0],
                    critical_max=cfg["critical"][1],
                    penalty_warn=cfg["penalty_warn"],
                    penalty_crit=cfg["penalty_crit"],
                    alert_code=cfg["alert_code"],
                    alert_msg=cfg["alert_msg"],
                    recommend_warn=cfg["recommend_warn"],
                    recommend_crit=cfg["recommend_crit"],
                )
            )

    db.commit()


def get_profile(locomotive_type: str, db: Session) -> dict:
    loco_type = locomotive_type.upper()
    base_profile = BASE_PROFILES.get(loco_type)

    if base_profile is None:
        raise ValueError(f"Unsupported locomotive_type: {loco_type}")

    rows = db.execute(
        select(ProfileConfig)
        .where(ProfileConfig.locomotive_type == loco_type)
        .order_by(ProfileConfig.parameter)
    ).scalars().all()

    profile = deepcopy(base_profile)
    profile["params"] = {}

    if not rows:
        return profile

    for row in rows:
        profile["params"][row.parameter] = {
            "label": row.label,
            "unit": row.unit,
            "direction": row.direction,
            "norm": [row.norm_min, row.norm_max],
            "warning": [row.warning_min, row.warning_max],
            "critical": [row.critical_min, row.critical_max],
            "penalty_warn": row.penalty_warn,
            "penalty_crit": row.penalty_crit,
            "alert_code": row.alert_code,
            "alert_msg": row.alert_msg,
            "recommend_warn": row.recommend_warn,
            "recommend_crit": row.recommend_crit,
        }

    return profile


def get_all_profiles(db: Session) -> list[dict]:
    return [get_profile(loco_type, db) for loco_type in BASE_PROFILES]