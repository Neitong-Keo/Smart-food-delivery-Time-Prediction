"""Check the report export against the prepared dataset and training artifacts."""

import json

import pytest

from ml.manifest import resolve_dataset_paths
from ml.report import export_report


def test_report_export_matches_the_training_manifest(tmp_path) -> None:
    paths = resolve_dataset_paths()
    if not (paths.routed_parquet.is_file() and paths.model_manifest.is_file()):
        pytest.skip("Route-enriched dataset or training artifacts not present.")
    manifest = json.loads(paths.model_manifest.read_text(encoding="utf-8"))
    if "models" not in manifest:
        pytest.skip("Artifacts predate per-model results. Retrain to export the report.")

    written = {path.name: json.loads(path.read_text(encoding="utf-8")) for path in export_report(tmp_path)}

    assert set(written) == {"eda.json", "outliers.json", "model.json"}
    model = written["model.json"]
    assert model["selected_model_id"] == manifest["selected_model_id"]
    assert [row["id"] for row in model["models"]] == list(manifest["models"])
    assert sum(day["training"] + day["validation"] + day["test"] for day in model["split"]["daily"]) == sum(
        partition["Rows"] for partition in manifest["split"].values()
    )
    histogram = model["evaluation"]["error_histogram"]
    assert all(sum(row[model_id] for row in histogram) <= model["evaluation"]["test_orders"] for model_id in manifest["models"])
    funnel = written["outliers.json"]["funnel"]
    assert [step["rows"] for step in funnel] == sorted((step["rows"] for step in funnel), reverse=True)
    eda = written["eda.json"]
    assert sum(row["orders"] for row in eda["target_histogram"]) == eda["rows"]
