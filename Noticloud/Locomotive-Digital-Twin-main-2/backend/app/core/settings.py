import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _parse_cors_origins(value: str | None) -> list[str]:
    if not value:
        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass
class Settings:
    app_name: str = os.getenv("APP_NAME", "Locomotive Digital Twin API")
    app_version: str = os.getenv("APP_VERSION", "0.1.0")
    debug: bool = os.getenv("DEBUG", "true").lower() == "true"
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8000"))
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5432/ktz_locomotive",
    )
    cors_origins: list[str] = field(
        default_factory=lambda: _parse_cors_origins(os.getenv("CORS_ORIGINS"))
    )
    admin_api_key: str = os.getenv("ADMIN_API_KEY", "supersecret123")

    ingest_rate_limit: int = int(os.getenv("INGEST_RATE_LIMIT", "120"))
    ingest_rate_window_seconds: int = int(os.getenv("INGEST_RATE_WINDOW_SECONDS", "60"))

    admin_rate_limit: int = int(os.getenv("ADMIN_RATE_LIMIT", "30"))
    admin_rate_window_seconds: int = int(os.getenv("ADMIN_RATE_WINDOW_SECONDS", "60"))

    ws_simulator_rate_limit: int = int(os.getenv("WS_SIMULATOR_RATE_LIMIT", "300"))
    ws_simulator_rate_window_seconds: int = int(os.getenv("WS_SIMULATOR_RATE_WINDOW_SECONDS", "60"))

    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "change_me_super_secret_jwt_key")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_access_token_expire_minutes: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "120"))

    auth_admin_username: str = os.getenv("AUTH_ADMIN_USERNAME", "admin")
    auth_admin_password: str = os.getenv("AUTH_ADMIN_PASSWORD", "admin123")

    auth_operator_username: str = os.getenv("AUTH_OPERATOR_USERNAME", "operator")
    auth_operator_password: str = os.getenv("AUTH_OPERATOR_PASSWORD", "operator123")

    auth_viewer_username: str = os.getenv("AUTH_VIEWER_USERNAME", "viewer")
    auth_viewer_password: str = os.getenv("AUTH_VIEWER_PASSWORD", "viewer123")


settings = Settings()