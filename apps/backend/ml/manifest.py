"""Dataset configuration loader and manifest helpers."""

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from ml import DEFAULT_DATASET_CONFIG_PATH, ML_BASE_DIR


@dataclass(frozen=True)
class DatasetPaths:
    """Resolved filesystem paths for datasets, manifests, and versioned artifacts."""

    base_dir: Path
    raw_csv: Path
    processed_parquet: Path
    dataset_manifest: Path
    artifacts_dir: Path
    model_artifact: Path
    metrics_artifact: Path
    model_manifest: Path
    routed_parquet: Path
    models_dir: Path


def load_dataset_config(
    config_path: Path = DEFAULT_DATASET_CONFIG_PATH,
) -> dict[str, Any]:
    """Load the YAML dataset configuration."""
    with config_path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)

    if not isinstance(data, dict):
        raise ValueError(f"Expected a YAML mapping in {config_path}")

    return data


def resolve_dataset_paths(
    config_path: Path = DEFAULT_DATASET_CONFIG_PATH,
) -> DatasetPaths:
    """Resolve all dataset and artifact paths against the single configured base_dir."""
    config = load_dataset_config(config_path)
    raw_base_dir = config.get("base_dir")

    if raw_base_dir:
        base_dir = (config_path.resolve().parent / raw_base_dir).resolve()
    else:
        base_dir = ML_BASE_DIR

    paths = config.get("paths", {})

    return DatasetPaths(
        base_dir=base_dir,
        raw_csv=base_dir / paths["raw_csv"],
        processed_parquet=base_dir / paths["processed_parquet"],
        dataset_manifest=base_dir / paths["dataset_manifest"],
        artifacts_dir=base_dir / paths["artifacts_dir"],
        model_artifact=base_dir / paths["model_artifact"],
        metrics_artifact=base_dir / paths["metrics_artifact"],
        model_manifest=base_dir / paths["model_manifest"],
        routed_parquet=base_dir / paths.get(
            "routed_parquet", "data/processed/dataset_with_routes.parquet"
        ),
        models_dir=base_dir / paths.get("models_dir", "artifacts/v1/models"),
    )


def build_manifest_placeholder() -> None:
    """Placeholder for generating dataset and model manifests in Phase 2."""
    raise NotImplementedError(
        "Manifest generation is scaffolded in Phase 1 and will be implemented "
        "once raw dataset headers are verified."
    )

