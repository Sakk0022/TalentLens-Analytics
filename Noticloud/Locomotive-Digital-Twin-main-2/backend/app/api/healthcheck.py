from fastapi import APIRouter
from sqlalchemy import text

from app.core.metrics import APP_READINESS, DB_STATUS
from app.core.settings import settings
from app.db.session import engine

router = APIRouter(tags=["Healthcheck"])


def check_database() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        DB_STATUS.set(1)
        return True
    except Exception:
        DB_STATUS.set(0)
        return False


@router.get("/health")
def healthcheck() -> dict:
    db_ok = check_database()

    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "debug": settings.debug,
        "database": "ok" if db_ok else "error",
    }


@router.get("/ready")
def readiness() -> dict:
    db_ok = check_database()
    ready = db_ok

    APP_READINESS.set(1 if ready else 0)

    return {
        "ready": ready,
        "database": "ok" if db_ok else "error",
    }