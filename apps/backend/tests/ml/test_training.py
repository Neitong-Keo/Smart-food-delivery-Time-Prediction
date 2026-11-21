"""Regression tests for the chronological median baseline."""

from functools import partial

import pandas as pd
import pytest
import yaml

from ml.manifest import load_dataset_config, resolve_dataset_paths
from ml.scripts import train
from ml.train import fit_median_baseline, run_training, split_chronologically


def test_split_keeps_timestamp_groups_together():
    timestamps = pd.date_range("2022-03-01", periods=7).repeat([5, 5, 3, 2, 3, 1, 1])
    records = pd.DataFrame({"order_timestamp": timestamps}).sample(frac=1, random_state=7)
    split = split_chronologically(records)

    assert split.summary()["Rows"].tolist() == [13, 5, 2]
    assert split.train["order_timestamp"].max() < split.validation["order_timestamp"].min()
    assert split.validation["order_timestamp"].max() < split.test["order_timestamp"].min()
    assert len(split.train) + len(split.validation) + len(split.test) == len(records)


def test_split_reports_missing_and_invalid_timestamps():
    records = pd.DataFrame({
        "order_timestamp": [
            "2022-03-03 13:00",
            None,
            "2022-03-01 13:00",
            "not a timestamp",
            "2022-03-02 13:00",
            " ",
        ]
    })
    split = split_chronologically(records)

    assert split.missing_timestamps == 2
    assert split.invalid_timestamps == 1
    assert split.summary()["Rows"].tolist() == [1, 1, 1]


def test_split_requires_three_distinct_valid_timestamps():
    records = pd.DataFrame({
        "order_timestamp": pd.to_datetime(["2022-03-01", "2022-03-01", "2022-03-02", None])
    })
    with pytest.raises(ValueError, match="at least three distinct.*Found 2.*1 missing"):
        split_chronologically(records)
    with pytest.raises(ValueError, match="missing the timestamp column"):
        split_chronologically(records.drop(columns="order_timestamp"))


def test_baseline_uses_training_median_and_validation_targets():
    schema = load_dataset_config()["schema"]
    features = schema["feature_allowlist"]
    target = schema["target_column"]
    records = pd.DataFrame({
        **{feature: pd.NA for feature in features},
        "order_timestamp": pd.date_range("2022-03-01", periods=20),
        "ID": "audit only",
        "Time_Order_picked": "audit only",
        target: [10] * 7 + [20] * 7 + [16, 20, 24, 100, 200, 300],
    })
    result = fit_median_baseline(records, features, target)

    assert result.feature_columns == tuple(features)
    assert result.split.summary()["Rows"].tolist() == [14, 3, 3]
    assert result.training_median == 15.0
    assert result.validation_mae == 5.0
    with pytest.raises(ValueError, match="unavailable at order placement"):
        fit_median_baseline(records, [*features, "Time_Order_picked"], target)


def test_cli_explains_missing_parquet(tmp_path, monkeypatch, capsys):
    config = load_dataset_config()
    config["base_dir"] = "."
    config_file = tmp_path / "dataset.yaml"
    config_file.write_text(yaml.safe_dump(config), encoding="utf-8")
    paths = resolve_dataset_paths(config_file)
    monkeypatch.setattr(train, "run_training", partial(run_training, config_file))

    assert train.main() == 1
    error = capsys.readouterr().err
    assert str(paths.processed_parquet) in error
    assert "python -m ml.scripts.ingest" in error
