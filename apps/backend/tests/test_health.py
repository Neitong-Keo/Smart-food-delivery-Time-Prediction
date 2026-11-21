"""Smoke tests for the FastAPI health endpoint and CORS configuration."""

from fastapi.testclient import TestClient

from app.core.config import DEFAULT_FRONTEND_ORIGIN
from app.main import app, create_app
from ml.manifest import resolve_dataset_paths


def test_health_endpoint_returns_ok_without_dataset_or_model() -> None:
    """API starts cleanly and returns HTTP 200 {'status': 'ok'} with no ML files present."""
    paths = resolve_dataset_paths()
    assert not paths.raw_csv.exists()
    assert not paths.model_artifact.exists()

    client = TestClient(app)
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_endpoint_allows_default_frontend_origin() -> None:
    """Default CORS policy allows requests from http://localhost:3600."""
    client = TestClient(create_app())
    response = client.get(
        "/api/health",
        headers={"Origin": DEFAULT_FRONTEND_ORIGIN},
    )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == DEFAULT_FRONTEND_ORIGIN

