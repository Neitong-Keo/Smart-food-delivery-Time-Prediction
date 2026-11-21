"""Model training workflow (Phase 1 scaffold)."""

from pathlib import Path

from ml import DEFAULT_DATASET_CONFIG_PATH
from ml.manifest import resolve_dataset_paths


def run_training(config_path: Path = DEFAULT_DATASET_CONFIG_PATH) -> None:
    """Train a delivery time model and persist versioned artifacts."""
    paths = resolve_dataset_paths(config_path)

    raise NotImplementedError(
        "Model training is not implemented yet (Phase 1 scaffold). "
        f"Expected processed dataset at '{paths.processed_parquet}' and "
        f"versioned outputs under '{paths.artifacts_dir}'."
    )

