"""Dataset ingestion workflow (Phase 1 scaffold)."""

from pathlib import Path

from ml import DEFAULT_DATASET_CONFIG_PATH
from ml.manifest import resolve_dataset_paths


def run_ingestion(config_path: Path = DEFAULT_DATASET_CONFIG_PATH) -> None:
    """Validate and convert the raw CSV into processed Parquet and manifest outputs."""
    paths = resolve_dataset_paths(config_path)

    raise NotImplementedError(
        "Dataset ingestion is not implemented yet (Phase 1 scaffold). "
        f"Place your raw CSV at '{paths.raw_csv}', verify its headers, "
        "update 'ml/configs/dataset.yaml', and implement 'ml/ingestion.py'."
    )

