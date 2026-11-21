"""Smoke tests for the FastAPI health endpoint and CORS configuration."""

from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import DEFAULT_FRONTEND_ORIGIN
from app.main import create_app


def test_health_endpoint_returns_ok_without_dataset_or_model(monkeypatch) -> None:
    """API starts cleanly and returns HTTP 200 {'status': 'ok'} with no ML files present."""
    open_file = Path.open

    def disallow_ml_files(path, *args, **kwargs):
        assert path.suffix not in {".csv", ".parquet", ".joblib"}
        return open_file(path, *args, **kwargs)

    monkeypatch.setattr(Path, "open", disallow_ml_files)

    client = TestClient(create_app())
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

