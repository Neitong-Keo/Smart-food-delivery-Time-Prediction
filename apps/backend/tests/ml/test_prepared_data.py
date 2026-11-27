"""Verify fitted preprocessing and chronological data preparation."""

import numpy as np
import pandas as pd
import pytest

from ml.pipeline import build_preprocessor
from ml.prepared_data import prepare_partitions
from ml.train import split_routed_orders


def test_preprocessing_preserves_columns_and_handles_missing_and_unseen_categories():
    train = pd.DataFrame({
        "City": pd.Series(["Urban", "Urban", pd.NA], dtype="string"),
        "Festival": ["no", None, "yes"],
        "order_hour": pd.Series([8, 12, pd.NA], dtype="Int64"),
        "road_distance_km": pd.Series([pd.NA, pd.NA, pd.NA], dtype="Float64"),
    })
    validation = pd.DataFrame({
        "City": ["Metropolitan", np.nan, None],
        "Festival": ["no", np.nan, pd.NA],
        "order_hour": [23.0, np.nan, 18.0],
        "road_distance_km": [2.0, np.nan, 4.0],
    })
    preprocessor = build_preprocessor(list(train)).fit(train)
    encoded = pd.DataFrame(
        preprocessor.transform(validation), columns=preprocessor.get_feature_names_out()
    )

    assert np.isfinite(encoded.to_numpy()).all()
    assert encoded["numeric__order_hour"].tolist() == [23.0, 10.0, 18.0]
    assert encoded["numeric__road_distance_km"].tolist() == [2.0, 0.0, 4.0]
    assert encoded.filter(like="categorical__City_").sum(axis=1).tolist() == [0.0, 1.0, 1.0]
    assert encoded["categorical__City_unknown"].tolist() == [0.0, 1.0, 1.0]
    assert encoded["categorical__Festival_unknown"].tolist() == [0.0, 1.0, 1.0]
    assert "categorical__City_Metropolitan" not in encoded


def test_prepared_partitions_use_only_training_statistics_and_preserve_targets():
    records = pd.DataFrame({
        "ID": [f"order-{number}" for number in range(12)],
        "order_timestamp": [*pd.date_range("2022-03-01", periods=11, freq="h"), pd.NaT],
        "road_distance_km": [2.0] * 10 + [42.0, np.nan],
        "order_hour": [10.0] * 7 + [np.nan, 23.0, 22.0, 21.0, 20.0],
        "City": ["Urban"] * 7 + ["Metropolitan"] * 5,
        "minutes": np.arange(10.0, 22.0),
    })
    result = split_routed_orders(records, "minutes", {"min": 0.1, "max": 40})
    prepared = prepare_partitions(result.split, ["City", "order_hour", "road_distance_km"], "minutes")

    assert result.missing_road_distance == result.outside_road_distance_limits == 1
    assert prepared["split"].value_counts().to_dict() == {"train": 7, "validation": 1, "test": 2}
    assert prepared["minutes"].tolist() == records.loc[:9, "minutes"].tolist()
    assert prepared.loc[7, "numeric__order_hour"] == 10.0
    assert prepared["categorical__City_Urban"].tolist() == [1.0] * 7 + [0.0] * 3
    assert "categorical__City_Metropolitan" not in prepared
    assert "ID" not in prepared

    records.loc[9, "ID"] = records.loc[0, "ID"]
    with pytest.raises(ValueError, match="Order IDs occur in multiple model partitions"):
        split_routed_orders(records, "minutes", {"min": 0.1, "max": 40})
