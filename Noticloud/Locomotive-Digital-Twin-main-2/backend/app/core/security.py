from fastapi import Depends, Header, HTTPException, status

from app.core.auth import get_optional_current_user
from app.core.settings import settings


def verify_admin_access(
    x_api_key: str | None = Header(default=None),
    current_user: dict | None = Depends(get_optional_current_user),
) -> None:
    if x_api_key == settings.admin_api_key:
        return

    if current_user and current_user["role"] == "admin" and not current_user["disabled"]:
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Admin authentication required",
    )