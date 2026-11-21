"""Health check response schema."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Payload returned by GET /api/health."""

    status: str

