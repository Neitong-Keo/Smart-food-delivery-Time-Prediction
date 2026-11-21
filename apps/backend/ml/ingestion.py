"""Read, clean, and verify the dataset and publish its quality report."""

import hashlib
import json
from pathlib import Path
from shutil import copyfile
from tempfile import TemporaryDirectory
from typing import Any

import pandas as pd

from ml import DEFAULT_DATASET_CONFIG_PATH
from ml.manifest import DatasetPaths, load_dataset_config, resolve_dataset_paths
from ml.preprocessing import clean_dataset
from ml.validation import read_raw_csv, validate_dataset, validate_feature_allowlist


def run_ingestion(
    config_path: Path = DEFAULT_DATASET_CONFIG_PATH, *, input_path: Path | None = None
) -> dict[str, Any]:
    """Clean a CSV and write the configured Parquet and JSON outputs."""
    config = load_dataset_config(config_path)
    paths = resolve_dataset_paths(config_path)
    source = (input_path if input_path is not None else paths.raw_csv).resolve()
    if len({source, paths.processed_parquet.resolve(), paths.dataset_manifest.resolve()}) != 3:
        raise ValueError("The input CSV, Parquet output and report must use distinct paths.")

    schema = config["schema"]
    target = schema["target_column"]
    features = schema["feature_allowlist"]
    validate_feature_allowlist(features)
    raw = read_raw_csv(source, schema["required_columns"])
    cleaned, report = clean_dataset(raw, schema, config["quality"])
    validate_dataset(cleaned, target, features)

    removed = report["duplicates"]["exact_rows_removed"] + sum(report["target_rejections"].values())
    if report["input_rows"] != len(cleaned) + removed:
        raise ValueError("Input, output, duplicate and target rejection counts do not reconcile.")
    report["source_file"] = source.name
    _publish_outputs(cleaned, report, paths, target, features)
    return report


def _publish_outputs(
    cleaned: pd.DataFrame,
    report: dict[str, Any],
    paths: DatasetPaths,
    target: str,
    features: list[str],
) -> None:
    parquet = paths.processed_parquet
    manifest = paths.dataset_manifest
    parquet.parent.mkdir(parents=True, exist_ok=True)
    manifest.parent.mkdir(parents=True, exist_ok=True)

    with (
        TemporaryDirectory(prefix=".ingest-", dir=parquet.parent) as data_tmp,
        TemporaryDirectory(prefix=".ingest-", dir=manifest.parent) as manifest_tmp,
    ):
        staged_data = Path(data_tmp) / "cleaned.parquet"
        staged_manifest = Path(manifest_tmp) / manifest.name
        cleaned.to_parquet(staged_data, engine="pyarrow", index=False)
        reopened = pd.read_parquet(staged_data, engine="pyarrow")
        validate_dataset(reopened, target, features)
        if len(reopened) != report["output_rows"] or not reopened.equals(cleaned):
            raise ValueError("Parquet round trip did not preserve the cleaned dataset.")
        with staged_data.open("rb") as handle:
            report["parquet_sha256"] = hashlib.file_digest(handle, "sha256").hexdigest()
        staged_manifest.write_text(
            json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8"
        )

        # Serialize writers and restore the previous data if manifest publication fails.
        lock = manifest.with_name(f".{manifest.name}.publish-lock")
        try:
            lock.mkdir()
        except FileExistsError as exc:
            raise ValueError(f"Output publication is locked at {lock}.") from exc
        try:
            backup = Path(data_tmp) / "previous.parquet"
            if parquet.exists():
                copyfile(parquet, backup)
            staged_data.replace(parquet)
            try:
                staged_manifest.replace(manifest)
            except OSError:
                if backup.exists():
                    backup.replace(parquet)
                else:
                    parquet.unlink()
                raise
        finally:
            lock.rmdir()
