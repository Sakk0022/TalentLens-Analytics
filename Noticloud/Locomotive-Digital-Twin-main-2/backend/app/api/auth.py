from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
)
from app.core.settings import settings
from app.schemas.auth import LoginRequest, TokenResponse, UserInfoResponse

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    user = authenticate_user(payload.username, payload.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(
        subject=user["username"],
        role=user["role"],
        expires_minutes=settings.jwt_access_token_expire_minutes,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.jwt_access_token_expire_minutes * 60,
        role=user["role"],
        username=user["username"],
    )


@router.get("/me", response_model=UserInfoResponse)
def me(current_user: dict = Depends(get_current_user)) -> UserInfoResponse:
    return UserInfoResponse(
        username=current_user["username"],
        role=current_user["role"],
        disabled=current_user["disabled"],
    )


@router.get("/admin-check")
def admin_check(current_user: dict = Depends(get_current_user)):
    return {
        "message": "Authenticated",
        "username": current_user["username"],
        "role": current_user["role"],
    }