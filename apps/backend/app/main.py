"""FastAPI application entry point."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as v1_router
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging
from app.schemas.health import HealthResponse

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the FastAPI application instance."""
    resolved_settings = settings or get_settings()
    configure_logging(resolved_settings.log_level)

    application = FastAPI(
        title=resolved_settings.app_name,
        version=resolved_settings.app_version,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.get("/api/health", response_model=HealthResponse, tags=["health"])
    def health_check() -> HealthResponse:
        """Return service readiness without requiring datasets or model artifacts."""
        return HealthResponse(status="ok")

    application.include_router(v1_router)

    logger.info(
        "Initialized %s v%s (CORS origins: %s)",
        resolved_settings.app_name,
        resolved_settings.app_version,
        ", ".join(resolved_settings.cors_allow_origins),
    )

    return application


app = create_app()

