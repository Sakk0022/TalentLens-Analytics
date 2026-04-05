import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.alerts import router as alerts_router
from app.api.auth import router as auth_router
from app.api.config import router as config_router
from app.api.health import router as health_router_api
from app.api.healthcheck import router as healthcheck_router
from app.api.history import router as history_router
from app.api.metrics import router as metrics_router
from app.api.report import router as report_router
from app.api.telemetry import router as telemetry_router
from app.api.ws import router as ws_router
from app.core.logging import setup_logging
from app.core.metrics import APP_READINESS, HTTP_REQUEST_DURATION_SECONDS, HTTP_REQUESTS_TOTAL
from app.core.settings import settings
from app.db.init_db import init_db

setup_logging(settings.debug)
logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting application and initializing database...")
    init_db()
    APP_READINESS.set(1)
    logger.info("Application startup completed.")
    yield
    APP_READINESS.set(0)
    logger.info("Application shutdown completed.")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        start_time = time.perf_counter()

        logger.info("[%s] Request started: %s %s", request_id, request.method, request.url.path)

        try:
            response = await call_next(request)
        except Exception:
            logger.exception("[%s] Unhandled exception", request_id)
            raise

        process_time = round(time.perf_counter() - start_time, 4)

        response.headers["X-Process-Time"] = str(process_time)
        response.headers["X-Request-ID"] = request_id

        HTTP_REQUESTS_TOTAL.labels(
            method=request.method,
            path=request.url.path,
            status_code=str(response.status_code),
        ).inc()

        HTTP_REQUEST_DURATION_SECONDS.labels(
            method=request.method,
            path=request.url.path,
        ).observe(process_time)

        logger.info(
            "[%s] Request completed: %s %s -> %s in %ss",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            process_time,
        )

        return response

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Validation error", "errors": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled server error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )

    @app.get("/", tags=["Root"])
    def root() -> dict:
        return {
            "message": "Locomotive Digital Twin backend is running",
            "docs": "/docs",
            "healthcheck": "/health",
            "readiness": "/ready",
            "metrics": "/metrics",
            "auth_login": "/api/auth/login",
            "auth_me": "/api/auth/me",
            "telemetry_ingest": "/api/telemetry/ingest",
            "history": "/api/history",
            "alerts": "/api/alerts",
            "health": "/api/health",
            "config": "/api/config",
            "report_csv": "/api/report/csv",
            "live_ws": "/ws/live",
            "simulator_ws": "/ws/simulator",
        }

    app.include_router(healthcheck_router)
    app.include_router(metrics_router)
    app.include_router(auth_router)
    app.include_router(telemetry_router)
    app.include_router(history_router)
    app.include_router(alerts_router)
    app.include_router(health_router_api)
    app.include_router(config_router)
    app.include_router(report_router)
    app.include_router(ws_router)

    return app


app = create_app()