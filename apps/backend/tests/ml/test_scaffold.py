"""Tests for the configured ML paths."""

from ml import ML_BASE_DIR
from ml.manifest import load_dataset_config, resolve_dataset_paths


def test_dataset_config_resolves_paths_under_ml_base_dir() -> None:
    """All configured data and artifact paths resolve under apps/backend/ml."""
    config = load_dataset_config()
    paths = resolve_dataset_paths()

    assert paths.base_dir == ML_BASE_DIR
    assert paths.raw_csv == ML_BASE_DIR / "data" / "raw" / "dataset.csv"
    assert paths.processed_parquet == ML_BASE_DIR / "data" / "processed" / "dataset.parquet"
    assert paths.dataset_manifest == ML_BASE_DIR / "data" / "manifests" / "dataset.json"
    assert paths.model_artifact == ML_BASE_DIR / "artifacts" / "v1" / "model.joblib"
    assert config["schema"]["target_column"] == "delivery_time_minutes"

