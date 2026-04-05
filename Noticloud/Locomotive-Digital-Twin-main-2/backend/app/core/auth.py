from datetime import datetime, timedelta, timezone
import secrets

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.settings import settings


security = HTTPBearer(auto_error=False)


def get_users_db() -> dict[str, dict]:
    return {
        settings.auth_admin_username: {
            "username": settings.auth_admin_username,
            "password": settings.auth_admin_password,
            "role": "admin",
            "disabled": False,
        },
        settings.auth_operator_username: {
            "username": settings.auth_operator_username,
            "password": settings.auth_operator_password,
            "role": "operator",
            "disabled": False,
        },
        settings.auth_viewer_username: {
            "username": settings.auth_viewer_username,
            "password": settings.auth_viewer_password,
            "role": "viewer",
            "disabled": False,
        },
    }


def verify_password(plain_password: str, stored_password: str) -> bool:
    return secrets.compare_digest(plain_password, stored_password)


def authenticate_user(username: str, password: str) -> dict | None:
    users_db = get_users_db()
    user = users_db.get(username)

    if not user:
        return None

    if not verify_password(password, user["password"]):
        return None

    if user.get("disabled", False):
        return None

    return user


def create_access_token(*, subject: str, role: str, expires_minutes: int | None = None) -> str:
    expire_minutes = expires_minutes or settings.jwt_access_token_expire_minutes
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)

    payload = {
        "sub": subject,
        "role": role,
        "exp": expire,
    }

    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return token


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict | None:
    if credentials is None:
        return None

    token = credentials.credentials
    payload = decode_access_token(token)

    username = payload.get("sub")
    role = payload.get("role")

    if not username or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    users_db = get_users_db()
    user = users_db.get(username)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if user.get("disabled", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is disabled",
        )

    return {
        "username": username,
        "role": role,
        "disabled": user.get("disabled", False),
    }


def get_current_user(
    current_user: dict | None = Depends(get_optional_current_user),
) -> dict:
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return current_user


def require_roles(*allowed_roles: str):
    def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return dependency