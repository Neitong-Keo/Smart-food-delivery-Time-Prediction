"""Summarize the dataset and training evidence as small JSON files for the web report.

The web app can't read Parquet, and reading 45,000 rows on every page view would be
slow, so this precomputes every chart's numbers once. Run it after training with
`python -m ml.scripts.export_report`.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from ml import DEFAULT_DATASET_CONFIG_PATH
from ml.manifest import load_dataset_config, resolve_dataset_paths
from ml.train import split_routed_orders

SEED = 42
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
LABELS = {
    "Type_of_order": "Order type",
    "Festival": "Festival",
    "City": "City type",
    "order_hour": "Order hour",
    "order_day_of_week": "Day of week",
    "road_distance_km": "Road distance (km)",
    "distance_km": "Straight-line distance (km)",
    "route_duration_minutes": "Route drive time (min)",
    "Weather_conditions": "Weather",
    "Road_traffic_density": "Traffic density",
    "Type_of_vehicle": "Vehicle type",
    "multiple_deliveries": "Multiple deliveries",
    "Vehicle_condition": "Vehicle condition",
    "Delivery_person_Age": "Rider age",
    "Delivery_person_Ratings": "Rider rating",
    "delivery_time_minutes": "Delivery time (min)",
    "ID": "Order ID",
    "Delivery_person_ID": "Rider ID",
    "Order_Date": "Order date",
    "Time_Orderd": "Order time",
    "Time_Order_picked": "Pickup time",
    "Time_taken (min)": "Delivery time (min)",
    "Delivery_location_latitude": "Customer latitude",
    "Delivery_location_longitude": "Customer longitude",
}
CATEGORY_ORDER = {
    "Type_of_order": ["snack", "meal", "drinks", "buffet"],
    "Festival": ["no", "yes"],
    "City": ["Semi-Urban", "Urban", "Metropolitan"],
    "Road_traffic_density": ["low", "medium", "high", "jam"],
    "Weather_conditions": ["sunny", "cloudy", "windy", "fog", "stormy", "sandstorms"],
    "Type_of_vehicle": ["bicycle", "electric_scooter", "scooter", "motorcycle"],
}
FEATURE_SOURCES = {
    "Type_of_order": "Order type control on the predict page",
    "Festival": "Festival checkbox on the predict page",
    "City": "Stored on the restaurant",
    "order_hour": "Order time in the restaurant's time zone",
    "order_day_of_week": "Order date in the restaurant's time zone",
    "road_distance_km": "OSRM road route from the restaurant to the pin",
}


def _round(value: Any, digits: int = 3) -> Any:
    if value is None or (isinstance(value, float) and not np.isfinite(value)):
        return None
    if isinstance(value, (float, np.floating)):
        return round(float(value), digits)
    if isinstance(value, (np.integer,)):
        return int(value)
    return value


def _box(values: pd.Series) -> dict[str, Any]:
    """Quartiles, 1.5 x IQR whiskers, and how many values fall outside them."""
    numbers = pd.Series(values, dtype="float64").dropna()
    if numbers.empty:
        return {"count": 0}
    q1, median, q3 = numbers.quantile([0.25, 0.5, 0.75])
    iqr = q3 - q1
    low_fence, high_fence = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    inside = numbers[numbers.between(low_fence, high_fence)]
    outliers = numbers[~numbers.between(low_fence, high_fence)]
    return {
        "count": int(len(numbers)),
        "mean": _round(numbers.mean()),
        "min": _round(numbers.min()),
        "q1": _round(q1),
        "median": _round(median),
        "q3": _round(q3),
        "max": _round(numbers.max()),
        "low": _round(inside.min()),
        "high": _round(inside.max()),
        "low_fence": _round(low_fence),
        "high_fence": _round(high_fence),
        "outliers": int(len(outliers)),
        "outliers_above": int((outliers > high_fence).sum()),
        "outliers_below": int((outliers < low_fence).sum()),
    }


def _sample(frame: pd.DataFrame, size: int) -> pd.DataFrame:
    return frame if len(frame) <= size else frame.sample(size, random_state=SEED)


def build_eda(
    cleaned: pd.DataFrame, routed: pd.DataFrame, dataset_report: dict, target: str, features: list[str]
) -> dict:
    model_sources = {*features}
    if {"order_hour", "order_day_of_week"} & model_sources:
        model_sources.update(("Time_Orderd", "Order_Date"))
    minutes = cleaned[target].astype("float64")
    counts = minutes.round().astype(int).value_counts().sort_index()
    hourly = cleaned.dropna(subset=["order_hour"]).groupby(cleaned["order_hour"].dropna().astype(int))[target]
    daily = cleaned.dropna(subset=["order_day_of_week"]).groupby(
        cleaned["order_day_of_week"].dropna().astype(int)
    )[target]

    categories = []
    for column in [
        "Type_of_order", "Festival", "City", "Weather_conditions", "Road_traffic_density",
        "Type_of_vehicle", "multiple_deliveries", "Vehicle_condition",
    ]:
        values = cleaned[column]
        order = CATEGORY_ORDER.get(column) or sorted(values.dropna().unique().tolist())
        groups = []
        for value in order:
            subset = minutes[values.astype("string").eq(str(value)).fillna(False).to_numpy()]
            if subset.empty:
                continue
            groups.append({"value": str(value), **_box(subset)})
        missing = minutes[values.isna().to_numpy()]
        if len(missing):
            groups.append({"value": "missing", **_box(missing)})
        categories.append({
            "column": column,
            "label": LABELS[column],
            "model_input": column in features,
            "groups": groups,
        })

    with_road = routed.dropna(subset=["road_distance_km"])
    road = with_road["road_distance_km"].astype("float64")
    road_minutes = with_road[target].astype("float64")
    bins = np.arange(0, 42, 2)
    binned = pd.cut(road, bins, right=False)
    distance_bins = [
        {
            "from": float(interval.left),
            "to": float(interval.right),
            "orders": int(len(group)),
            "mean": _round(group.mean()),
            "q1": _round(group.quantile(0.25)),
            "q3": _round(group.quantile(0.75)),
        }
        for interval, group in road_minutes.groupby(binned, observed=True)
        if len(group) >= 20
    ]
    points = _sample(pd.DataFrame({"x": road, "y": road_minutes}), 1500)

    missing_raw = {
        column: info["missing"] for column, info in dataset_report["raw_profile"]["columns"].items()
    }
    zero_pairs = dataset_report["distance"]["coordinate_pair_issues"]["restaurant"]["zero_pair"]
    # Cleaning renames or combines some columns. Count each raw column's gaps in its cleaned form.
    # The timestamp combines date and time. Its gaps all come from missing times.
    cleaned_name = {
        "Time_Orderd": "order_timestamp",
        "Time_taken (min)": "delivery_time_minutes",
    }
    # Restaurant coordinates are never blank, but (0, 0) means unknown. Report them as one row.
    missing = [
        {
            "column": column,
            "label": LABELS.get(column, column),
            "raw_missing": int(missing_raw.get(column, 0)),
            "missing_after_cleaning": int(cleaned[cleaned_name.get(column, column)].isna().sum())
            if cleaned_name.get(column, column) in cleaned
            else None,
            "model_input": column in model_sources,
        }
        for column in dataset_report["raw_profile"]["columns"]
        if column not in {"Restaurant_latitude", "Restaurant_longitude"}
    ]
    missing.append({
        "column": "Restaurant_latitude",
        "label": "Restaurant location (0, 0)",
        "raw_missing": int(zero_pairs),
        "missing_after_cleaning": int(cleaned["Restaurant_latitude"].isna().sum()),
        "model_input": True,
    })
    missing.append({
        "column": "road_distance_km",
        "label": LABELS["road_distance_km"],
        "raw_missing": None,
        "missing_after_cleaning": int(routed["road_distance_km"].isna().sum()),
        "model_input": True,
    })
    missing.sort(key=lambda row: -(row["missing_after_cleaning"] or row["raw_missing"] or 0))

    correlation = []
    numeric = {
        "road_distance_km": routed["road_distance_km"],
        "distance_km": routed["distance_km"],
        "route_duration_minutes": routed["route_duration_minutes"],
        "order_hour": routed["order_hour"],
        "order_day_of_week": routed["order_day_of_week"],
        "multiple_deliveries": routed["multiple_deliveries"],
        "Vehicle_condition": routed["Vehicle_condition"],
        "Delivery_person_Age": routed["Delivery_person_Age"],
        "Delivery_person_Ratings": routed["Delivery_person_Ratings"],
    }
    target_values = routed[target].astype("float64")
    for column, values in numeric.items():
        pair = pd.DataFrame({"x": values.astype("float64"), "y": target_values}).dropna()
        correlation.append({
            "column": column,
            "label": LABELS[column],
            "orders": int(len(pair)),
            "pearson": _round(pair["x"].corr(pair["y"])),
            "spearman": _round(pair["x"].corr(pair["y"], method="spearman")),
            "model_input": column in features,
        })
    correlation.sort(key=lambda row: -abs(row["pearson"] or 0))

    timestamps = cleaned["order_timestamp"].dropna()
    return {
        "rows": int(len(cleaned)),
        "columns": int(dataset_report["raw_profile"]["column_count"]),
        "first_order": timestamps.min().strftime("%Y-%m-%d"),
        "last_order": timestamps.max().strftime("%Y-%m-%d"),
        "cities": int(cleaned["Delivery_person_ID"].str.extract(r"^([A-Z]+)RES", expand=False).nunique()),
        "target": _box(minutes),
        "target_histogram": [{"minutes": int(value), "orders": int(count)} for value, count in counts.items()],
        "by_hour": [
            {"hour": int(hour), "orders": int(len(group)), "mean": _round(group.mean()), "median": _round(group.median())}
            for hour, group in hourly
        ],
        "by_day": [
            {"day": int(day), "label": WEEKDAYS[int(day)], "orders": int(len(group)), "mean": _round(group.mean())}
            for day, group in daily
        ],
        "by_category": categories,
        "distance": {
            "orders": int(len(with_road)),
            "pearson": _round(road.corr(road_minutes)),
            "points": [[_round(x, 2), _round(y, 0)] for x, y in points.itertuples(index=False)],
            "bins": distance_bins,
        },
        "missing": missing,
        "correlation": correlation,
    }


def build_outliers(cleaned: pd.DataFrame, routed: pd.DataFrame, dataset_report: dict, manifest: dict, target: str, config: dict) -> dict:
    quality = config["quality"]
    blocked = config["serving"]["blocked_road_distance_km"]
    numeric_quality = dataset_report["numeric_features_quality"]
    distance = dataset_report["distance"]
    duplicates = dataset_report["duplicates"]
    timestamps = dataset_report["timestamps"]
    usable_coordinates = int(routed["distance_km"].notna().sum())
    routed_rows = int(routed["road_distance_km"].notna().sum())
    in_limits = int(routed["road_distance_km"].between(blocked["min"], blocked["max"]).sum())
    split_rows = sum(int(partition["Rows"]) for partition in manifest["split"].values())

    rules = [
        {
            "stage": "cleaning",
            "title": "Exact duplicate rows",
            "rule": "Every field matches an earlier row.",
            "rows": duplicates["exact_rows_removed"],
            "action": "Dropped",
        },
        {
            "stage": "cleaning",
            "title": "Conflicting order IDs",
            "rule": "Different rows share the same order ID.",
            "rows": duplicates["rows_with_conflicting_order_ids"],
            "action": "Kept and flagged",
        },
        {
            "stage": "cleaning",
            "title": "Invalid delivery time",
            "rule": "Missing, not a number, or zero or less.",
            "rows": sum(dataset_report["target_rejections"].values()),
            "action": "Dropped",
        },
        {
            "stage": "cleaning",
            "title": "Long delivery",
            "rule": f"Delivery took over {quality['long_delivery_review_minutes']} minutes.",
            "rows": dataset_report["target_review"]["long_deliveries"],
            "action": "Kept and flagged for review",
        },
        {
            "stage": "cleaning",
            "title": "Restaurant at (0, 0)",
            "rule": "Latitude and longitude are both zero, which means the location is unknown.",
            "rows": distance["coordinate_pair_issues"]["restaurant"]["zero_pair"],
            "action": "Set to empty",
        },
        {
            "stage": "cleaning",
            "title": "Straight-line distance over 100 km",
            "rule": f"Over {quality['max_straight_line_distance_km']} km between restaurant and customer. "
            "All of these have a restaurant with negative coordinates.",
            "rows": distance["implausible_distances"],
            "action": "Distance set to empty",
        },
        {
            "stage": "cleaning",
            "title": "Rider rating above 5",
            "rule": "Ratings must be between 1 and 5.",
            "rows": numeric_quality["Delivery_person_Ratings"]["out_of_range"],
            "action": "Set to empty",
        },
        {
            "stage": "cleaning",
            "title": "Rider age out of range",
            "rule": "Ages must be whole numbers from 1 to 120.",
            "rows": numeric_quality["Delivery_person_Age"]["out_of_range"]
            + numeric_quality["Delivery_person_Age"]["not_integer"],
            "action": "Set to empty",
        },
        {
            "stage": "cleaning",
            "title": "Rider under 18",
            "rule": "Age is valid but under 18.",
            "rows": numeric_quality["Delivery_person_Age"]["under_18_review"],
            "action": "Kept and flagged for review",
        },
        {
            "stage": "cleaning",
            "title": "Missing order time",
            "rule": "Time_Orderd is blank, so the order hour and day are unknown.",
            "rows": timestamps["missing_time"],
            "action": "Timestamp set to empty",
        },
        {
            "stage": "cleaning",
            "title": "Order time stored as a fraction of a day",
            "rule": "Some times are written as 0.5 instead of 12:00. A value of 1 means midnight.",
            "rows": timestamps["fractional_day_times"],
            "action": "Converted to a clock time",
        },
        {
            "stage": "model",
            "title": "No road distance",
            "rule": "No valid coordinates, no road route, or a point more than "
            f"{config['serving']['max_point_to_road_m']} m from a road.",
            "rows": manifest["rows_missing_road_distance"],
            "action": "Left out of training",
        },
        {
            "stage": "model",
            "title": "Road distance outside the app's limits",
            "rule": f"Under {blocked['min']} km or over {blocked['max']} km by road.",
            "rows": manifest["rows_outside_road_distance_limits"],
            "action": "Left out of training",
        },
        {
            "stage": "model",
            "title": "No usable order timestamp",
            "rule": "The chronological split needs the order time.",
            "rows": manifest["rows_without_usable_timestamp"],
            "action": "Left out of training",
        },
    ]

    funnel = [
        {"label": "Rows in the CSV", "rows": int(dataset_report["input_rows"])},
        {"label": "After cleaning", "rows": int(dataset_report["output_rows"])},
        {"label": "Valid coordinates", "rows": usable_coordinates},
        {"label": "With a road distance", "rows": routed_rows},
        {"label": f"Within {blocked['min']}–{blocked['max']} km", "rows": in_limits},
        {"label": "With an order timestamp", "rows": split_rows},
    ]

    boxes = []
    for column, frame in [(target, cleaned), ("road_distance_km", routed), ("distance_km", cleaned)]:
        values = frame[column].astype("float64").dropna()
        box = _box(values)
        fences = (box["low_fence"], box["high_fence"])
        outside = values[~values.between(*fences)]
        boxes.append({
            "column": column,
            "label": LABELS[column],
            **box,
            "outlier_values": [_round(value, 2) for value in _sample(outside.to_frame(), 300)[column]],
        })

    long_fence = next(box["high_fence"] for box in boxes if box["column"] == target)
    long_orders = routed.loc[routed[target].astype("float64") > long_fence]
    explained = long_orders["Festival"].eq("yes").fillna(False) | long_orders["multiple_deliveries"].ge(2).fillna(False)
    road_fence = next(box["high_fence"] for box in boxes if box["column"] == "road_distance_km")
    detour = (routed["road_distance_km"] / routed["distance_km"]).astype("float64")
    far = routed["road_distance_km"].astype("float64") > road_fence

    return {
        "rules": rules,
        "funnel": funnel,
        "boxes": boxes,
        "long_delivery_festival_or_multi_share": _round(float(explained.mean()), 3),
        "road_detour_ratio": {
            "outliers": _round(float(detour[far].median()), 2),
            "all": _round(float(detour.median()), 2),
        },
        "max_straight_line_excluded_km": {
            "min": _round(distance["excluded_km"]["min"], 0),
            "max": _round(distance["excluded_km"]["max"], 0),
        },
        "retained_straight_line_km": {
            "min": _round(distance["retained_km"]["min"], 2),
            "max": _round(distance["retained_km"]["max"], 2),
        },
        "road_distance_km": {
            "min": _round(routed["road_distance_km"].min(), 2),
            "max": _round(routed["road_distance_km"].max(), 2),
        },
    }


def build_model(routed: pd.DataFrame, manifest: dict, predictions: pd.DataFrame, config: dict) -> dict:
    serving = config["serving"]
    blocked = serving["blocked_road_distance_km"]
    split = split_routed_orders(routed, manifest["target"], blocked).split
    timeline: dict[str, dict[str, int]] = {}
    for name, partition in [("training", split.train), ("validation", split.validation), ("test", split.test)]:
        for day, count in partition["order_timestamp"].dt.strftime("%Y-%m-%d").value_counts().items():
            timeline.setdefault(day, {"training": 0, "validation": 0, "test": 0})[name] = int(count)

    models = manifest["models"]
    model_ids = list(models)
    tuning_by_name = manifest["tuning"]
    model_rows = []
    for model_id, model in models.items():
        model_rows.append({
            "id": model_id,
            "name": model["name"],
            "selected": model["selected"],
            "parameters": model["parameters"],
            "validation": {key: _round(value, 4) for key, value in model["validation"].items()},
            "test": {key: _round(value, 4) for key, value in model["test"].items()},
            "trials": [
                {
                    "parameters": trial["parameters"],
                    **{key: _round(trial[key], 4) for key in ("mae", "rmse", "r2")},
                }
                for trial in tuning_by_name.get(model["name"], [])
            ],
            "importance": {
                feature: _round(value, 4)
                for feature, value in (model.get("validation_feature_importance_mae_increase") or {}).items()
            },
        })

    actual = predictions["actual_minutes"]
    edges = list(range(-30, 32, 2))
    histogram = []
    for low, high in zip(edges[:-1], edges[1:]):
        row: dict[str, Any] = {"from": low, "to": high}
        for model_id in model_ids:
            errors = predictions[f"predicted_{model_id}"] - actual
            row[model_id] = int(errors.between(low, high, inclusive="left").sum())
        histogram.append(row)

    buckets = [(10, 20), (20, 30), (30, 40), (40, 55)]
    by_actual = []
    for low, high in buckets:
        mask = actual.between(low, high, inclusive="left")
        row = {"label": f"{low}–{high - 1} min", "orders": int(mask.sum())}
        for model_id in model_ids:
            errors = predictions.loc[mask, f"predicted_{model_id}"] - actual[mask]
            row[model_id] = {"mae": _round(errors.abs().mean(), 2), "bias": _round(errors.mean(), 2)}
        by_actual.append(row)

    by_minute = []
    for minute, group in predictions.groupby(actual.round().astype(int)):
        if len(group) < 15:
            continue
        row = {"actual": int(minute), "orders": int(len(group))}
        for model_id in model_ids:
            values = group[f"predicted_{model_id}"]
            row[model_id] = {
                "mean": _round(values.mean(), 2),
                "p10": _round(values.quantile(0.1), 2),
                "p90": _round(values.quantile(0.9), 2),
            }
        by_minute.append(row)

    sample = _sample(predictions, 700)
    scatter = {
        model_id: [[_round(a, 0), _round(p, 2)] for a, p in zip(sample["actual_minutes"], sample[f"predicted_{model_id}"])]
        for model_id in model_ids
    }

    selected = next(row for row in model_rows if row["selected"])
    features = [
        {
            "column": feature,
            "label": LABELS[feature],
            "type": "category" if feature in {"Type_of_order", "Festival", "City"} else "number",
            "source": FEATURE_SOURCES[feature],
            "importance": {
                row["id"]: row["importance"].get(feature) for row in model_rows if row["importance"]
            },
        }
        for feature in manifest["features"]
    ]
    features.sort(key=lambda feature: -(feature["importance"].get(selected["id"]) or 0))

    return {
        "selected_model_id": manifest["selected_model_id"],
        "target": manifest["target"],
        "features": features,
        "models": model_rows,
        "split": {
            "partitions": [
                {
                    "name": name,
                    "rows": int(partition["Rows"]),
                    "share": _round(partition["Share (%)"], 1),
                    "first": partition["First order"][:16].replace("T", " "),
                    "last": partition["Last order"][:16].replace("T", " "),
                }
                for name, partition in manifest["split"].items()
            ],
            "daily": [{"date": day, **counts} for day, counts in sorted(timeline.items())],
            "rows_in_source": manifest["rows_in_source"],
            "rows_missing_road_distance": manifest["rows_missing_road_distance"],
            "rows_outside_road_distance_limits": manifest["rows_outside_road_distance_limits"],
            "rows_without_usable_timestamp": manifest["rows_without_usable_timestamp"],
        },
        "limits": {
            "training_road_distance_km": manifest["training_road_distance_km"],
            "blocked_road_distance_km": blocked,
            "supported_order_hours": serving["supported_order_hours"],
            "max_point_to_road_m": serving["max_point_to_road_m"],
        },
        "evaluation": {
            "test_orders": int(len(predictions)),
            "error_histogram": histogram,
            "by_actual": by_actual,
            "by_minute": by_minute,
            "scatter": scatter,
        },
        "dataset_sha256": manifest.get("dataset_sha256"),
    }


def export_report(output_dir: Path, config_path: Path = DEFAULT_DATASET_CONFIG_PATH) -> list[Path]:
    """Write eda.json, outliers.json and model.json, and return their paths."""
    config = load_dataset_config(config_path)
    paths = resolve_dataset_paths(config_path)
    target = config["schema"]["target_column"]
    for required, command in [
        (paths.processed_parquet, "python -m ml.scripts.ingest"),
        (paths.routed_parquet, "python -m ml.scripts.enrich_routes"),
        (paths.model_manifest, "python -m ml.scripts.train_models"),
    ]:
        if not required.is_file():
            raise FileNotFoundError(f"Missing '{required}'. Run '{command}' first.")

    cleaned = pd.read_parquet(paths.processed_parquet)
    routed = pd.read_parquet(paths.routed_parquet)
    dataset_report = json.loads(paths.dataset_manifest.read_text(encoding="utf-8"))
    manifest = json.loads(paths.model_manifest.read_text(encoding="utf-8"))
    if "models" not in manifest:
        raise ValueError("The training manifest has no per-model results. Retrain with ml.scripts.train_models.")
    predictions = pd.read_csv(paths.artifacts_dir / "test_predictions.csv")

    generated = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_file": dataset_report.get("source_file"),
    }
    reports = {
        "eda.json": build_eda(cleaned, routed, dataset_report, target, manifest["features"]),
        "outliers.json": build_outliers(cleaned, routed, dataset_report, manifest, target, config),
        "model.json": build_model(routed, manifest, predictions, config),
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for name, payload in reports.items():
        path = output_dir / name
        path.write_text(
            json.dumps({**generated, **payload}, separators=(",", ":"), allow_nan=False),
            encoding="utf-8",
        )
        written.append(path)
    return written
