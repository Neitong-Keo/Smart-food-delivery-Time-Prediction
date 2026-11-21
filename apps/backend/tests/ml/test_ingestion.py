"""Regression tests for deterministic dataset ingestion."""

import csv
import hashlib
import json
from functools import partial

import numpy as np
import pandas as pd
import pytest
import yaml

from ml.ingestion import run_ingestion
from ml.manifest import load_dataset_config, resolve_dataset_paths
from ml.preprocessing import (
    clean_coordinates,
    clean_dataset,
    normalize_text,
    parse_delivery_time,
    parse_order_timestamp,
)
from ml.scripts import ingest
from ml.validation import read_raw_csv, validate_dataset, validate_feature_allowlist


@pytest.fixture
def config():
    return load_dataset_config()


@pytest.fixture
def order():
    return {
        "ID": "one",
        "Delivery_person_ID": " rider-one ",
        "Delivery_person_Age": "25",
        "Delivery_person_Ratings": "4.6",
        "Restaurant_latitude": "19.00",
        "Restaurant_longitude": "72.80",
        "Delivery_location_latitude": "19.06",
        "Delivery_location_longitude": "72.90",
        "Order_Date": "15-03-2022",
        "Time_Orderd": "09:15",
        "Time_Order_picked": "09:30",
        "Weather_conditions": " Sunny ",
        "Road_traffic_density": "LOW",
        "Vehicle_condition": "0",
        "Type_of_order": " SNACK ",
        "Type_of_vehicle": "electric_scooter",
        "multiple_deliveries": "0",
        "Festival": " No ",
        "City": " Metropolitian ",
        "Time_taken (min)": "24",
    }


def test_target_parsing_accounts_for_every_rejection(config):
    values = pd.Series(
        [" 12 ", "(min) 75.5", " \tNaN ", "", "typo", "(min)", "inf",
         "-Infinity", "1e400", "0", "-4"],
        dtype="string",
    )
    values = normalize_text(values, config["quality"]["missing_markers"])
    parsed, rejected = parse_delivery_time(values)

    assert parsed.dropna().tolist() == [12.0, 75.5]
    assert rejected == {"missing": 2, "malformed": 2, "non_finite": 3, "non_positive": 2}


def test_duplicates_and_conflicts_are_accounted_for_separately(config, order):
    raw = pd.DataFrame(
        [
            order,
            order,
            {**order, "ID": " one ", "Time_taken (min)": "75"},
            {**order, "ID": "two", "Time_taken (min)": "bad"},
            {**order, "ID": ""},
            {**order, "ID": "NaN"},
        ],
        dtype="string",
    )
    cleaned, report = clean_dataset(raw, config["schema"], config["quality"])

    assert len(cleaned) == 4
    assert cleaned["order_id_conflict"].tolist() == [True, True, False, False]
    assert cleaned["long_delivery_review"].tolist() == [False, True, False, False]
    assert report["duplicates"]["exact_rows_removed"] == 1
    assert report["duplicates"]["raw_repeated_order_ids"] == 1
    assert report["duplicates"]["raw_rows_with_repeated_order_ids"] == 3
    assert report["duplicates"]["conflicting_order_ids"] == 1
    assert report["target_rejections"]["malformed"] == 1


def test_categorical_and_numeric_cleaning_preserves_meaningful_values(config, order):
    invalid = {
        **order,
        "ID": "two",
        "City": "Semi-Urban",
        "Weather_conditions": " NaN ",
        "Delivery_person_Age": "unknown",
        "Delivery_person_Ratings": "6",
        "Vehicle_condition": "1.5",
        "multiple_deliveries": "NaN",
    }
    raw = pd.DataFrame([order, invalid], dtype="string")
    cleaned, report = clean_dataset(raw, config["schema"], config["quality"])

    assert cleaned["City"].tolist() == ["Metropolitan", "Semi-Urban"]
    assert cleaned["Type_of_vehicle"].tolist() == ["electric_scooter", "electric_scooter"]
    assert cleaned["Festival"].tolist() == ["no", "no"]
    assert cleaned["Type_of_order"].tolist() == ["snack", "snack"]
    assert cleaned.loc[1, "Weather_conditions"] is pd.NA
    assert cleaned.loc[0, ["Vehicle_condition", "multiple_deliveries"]].tolist() == [0, 0]
    assert cleaned.loc[1, ["Vehicle_condition", "multiple_deliveries"]].isna().all()
    numeric = report["numeric_features_quality"]
    assert numeric["Delivery_person_Age"]["malformed"] == 1
    assert numeric["Delivery_person_Ratings"]["out_of_range"] == 1
    assert numeric["Vehicle_condition"]["not_integer"] == 1
    assert numeric["multiple_deliveries"]["missing"] == 1


def test_order_timestamps_handle_fractions_midnight_and_invalid_values():
    dates = pd.Series(["15-03-2022"] * 5 + ["31-02-2022", None, "11-04-2262"], dtype="string")
    times = pd.Series(
        ["09:15", "0.833333333", "1", "25:00", "1.1", "09:00", None, "1"], dtype="string"
    )
    timestamps, stats = parse_order_timestamp(dates, times)

    assert timestamps.iloc[:3].tolist() == [
        pd.Timestamp("2022-03-15 09:15"),
        pd.Timestamp("2022-03-15 20:00"),
        pd.Timestamp("2022-03-16 00:00"),
    ]
    assert timestamps.iloc[3:].isna().all()
    assert stats["invalid_date"] == 1
    assert stats["invalid_time"] == 2
    assert stats["midnight_rollovers"] == 2
    assert stats["out_of_range_timestamp"] == 1
    assert stats["null_timestamp"] == 5


def test_distance_validates_pairs_and_preserves_single_zeros(order):
    frame = pd.DataFrame(
        [
            {**order, "Restaurant_latitude": "0", "Delivery_location_latitude": "0"},
            {**order, "Restaurant_latitude": "0", "Restaurant_longitude": "0"},
            {**order, "Delivery_location_latitude": "91"},
            {**order, "Restaurant_longitude": "inf"},
            {**order, "Restaurant_latitude": "-19"},
            {**order, "Delivery_location_latitude": "19", "Delivery_location_longitude": "72.8"},
        ],
        dtype="string",
    )
    coordinates, distances, report = clean_coordinates(frame, max_distance_km=100)

    assert distances.iloc[0] == pytest.approx(11.1195, abs=0.0001)
    assert distances.iloc[1:5].isna().all()
    assert distances.iloc[5] == 0
    assert coordinates.loc[4, "Restaurant_latitude"] == -19
    assert report["coordinate_pair_issues"]["restaurant"]["zero_pair"] == 1
    assert report["coordinate_pair_issues"]["restaurant"]["non_finite_component"] == 1
    assert report["coordinate_pair_issues"]["delivery"]["out_of_range"] == 1
    assert report["implausible_distances"] == 1


@pytest.mark.parametrize(
    "unavailable",
    [
        "ID", "delivery_time_minutes", "Time_Order_picked", "pickup_hour", "Delivery_person_Age",
        "Type_of_vehicle", "multiple_deliveries", "Road_traffic_density", "order_timestamp",
    ],
)
def test_feature_allowlist_rejects_fields_without_order_time_availability(config, unavailable):
    features = config["schema"]["feature_allowlist"]
    assert set(features) == {
        "Type_of_order", "City", "Festival", "order_hour", "order_day_of_week", "distance_km"
    }
    validate_feature_allowlist(features)
    with pytest.raises(ValueError, match=unavailable):
        validate_feature_allowlist([*features, unavailable])


def test_target_cannot_be_configured_as_an_allowlisted_column():
    with pytest.raises(ValueError, match="target column must be excluded"):
        validate_dataset(pd.DataFrame({"distance_km": [12.0]}), "distance_km", ["distance_km"])


@pytest.mark.parametrize(
    ("header", "error"),
    [
        ("ID,City\n", "Missing required CSV columns"),
        ("ID, ID ,Time_taken (min)\n", "collide after trimming"),
    ],
)
def test_header_errors_are_reported_before_reading_data(tmp_path, header, error):
    raw = tmp_path / "sample.csv"
    raw.write_text(header, encoding="utf-8")
    with pytest.raises(ValueError, match=error):
        read_raw_csv(raw, ["ID", "Time_taken (min)"])


@pytest.mark.parametrize("explicit_input", [False, True])
def test_ingest_cli_reopens_parquet_and_reconciles_report(
    tmp_path, monkeypatch, config, order, explicit_input
):
    config["base_dir"] = "."
    config_path = tmp_path / "dataset.yaml"
    config_path.write_text(yaml.safe_dump(config), encoding="utf-8")
    paths = resolve_dataset_paths(config_path)
    source = tmp_path / "Sample Dataset.csv" if explicit_input else paths.raw_csv
    source.parent.mkdir(parents=True, exist_ok=True)
    with source.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow([f" {name} " for name in order])
        writer.writerow(order.values())
        writer.writerow(order.values())
        writer.writerow({**order, "ID": "two", "Time_taken (min)": "0"}.values())
    original = source.read_bytes()
    monkeypatch.setattr(ingest, "run_ingestion", partial(run_ingestion, config_path))

    args = ["--input", str(source)] if explicit_input else []
    assert ingest.main(args) == 0
    assert source.read_bytes() == original
    cleaned = pd.read_parquet(paths.processed_parquet)
    report = json.loads(paths.dataset_manifest.read_text(encoding="utf-8"))
    assert len(cleaned) == report["output_rows"] == 1
    assert report["input_rows"] == 3
    assert report["input_rows"] == (
        report["output_rows"] + report["duplicates"]["exact_rows_removed"]
        + sum(report["target_rejections"].values())
    )
    assert report["target_rejections"]["non_positive"] == 1
    assert report["raw_profile"]["columns"]["Type_of_order"]["common_values"] == {"SNACK": 3}
    assert report["parquet_sha256"] == hashlib.sha256(paths.processed_parquet.read_bytes()).hexdigest()
    assert cleaned["order_hour"].tolist() == [9]
    assert cleaned["order_day_of_week"].tolist() == [1]
    targets = cleaned["delivery_time_minutes"].to_numpy(dtype=float)
    assert (np.isfinite(targets) & (targets > 0)).all()
