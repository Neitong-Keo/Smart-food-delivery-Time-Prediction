"""Tests for the Phase 1 ML workflow scaffold."""

from ml import ML_BASE_DIR
from ml.manifest import load_dataset_config, resolve_dataset_paths
from ml.scripts import ingest, train


def test_dataset_config_resolves_paths_under_ml_base_dir() -> None:
    """All configured data and artifact paths resolve under apps/backend/ml."""
    config = load_dataset_config()
    paths = resolve_dataset_paths()

    assert paths.base_dir == ML_BASE_DIR
    assert paths.raw_csv == ML_BASE_DIR / "data" / "raw" / "dataset.csv"
    assert paths.processed_parquet == ML_BASE_DIR / "data" / "processed" / "dataset.parquet"
    assert paths.dataset_manifest == ML_BASE_DIR / "data" / "manifests" / "dataset.json"
    assert paths.model_artifact == ML_BASE_DIR / "artifacts" / "v1" / "model.joblib"
    assert config["schema"]["target_column"] is None


def test_placeholder_cli_commands_exit_nonzero(capsys) -> None:
    """Phase 1 placeholder CLIs exit with nonzero status and print clear guidance."""
    ingest_exit_code = ingest.main()
    ingest_err = capsys.readouterr().err

    assert ingest_exit_code != 0
    assert "ml.scripts.ingest" in ingest_err

    train_exit_code = train.main()
    train_err = capsys.readouterr().err

    assert train_exit_code != 0
    assert "ml.scripts.train" in train_err

