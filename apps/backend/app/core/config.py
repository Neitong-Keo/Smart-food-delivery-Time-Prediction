"""Application settings loaded from environment variables."""

from dataclasses import dataclass, field
import os


DEFAULT_FRONTEND_ORIGIN = "http://localhost:3600"


def _parse_origins(raw_origins: str | None) -> list[str]:
    """Split a comma-separated list of CORS origins into clean entries."""
    if not raw_origins:
        return [DEFAULT_FRONTEND_ORIGIN]

    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or [DEFAULT_FRONTEND_ORIGIN]


@dataclass(frozen=True)
class Settings:
    """Runtime configuration for the FastAPI service."""

    app_name: str = "Smart Food Delivery Time Prediction API"
    app_version: str = "0.1.0"
    log_level: str = "INFO"
    cors_allow_origins: list[str] = field(
        default_factory=lambda: [DEFAULT_FRONTEND_ORIGIN]
    )
    prediction_mode: str = "demo"
    model_path: str | None = None


def get_settings() -> Settings:
    """Build settings from the current process environment."""
    return Settings(
        app_name=os.getenv("APP_NAME", "Smart Food Delivery Time Prediction API"),
        app_version=os.getenv("APP_VERSION", "0.1.0"),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        cors_allow_origins=_parse_origins(os.getenv("CORS_ALLOW_ORIGINS")),
        prediction_mode=os.getenv("PREDICTION_MODE", "demo").strip().lower(),
        model_path=os.getenv("MODEL_PATH", "").strip() or None,
    )

