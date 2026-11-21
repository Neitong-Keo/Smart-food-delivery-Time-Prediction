"""Deterministic cleaning and profiling for delivery records."""

from typing import Any

import numpy as np
import pandas as pd

from ml.validation import numeric_violations


CATEGORICAL_COLUMNS = (
    "Weather_conditions",
    "Road_traffic_density",
    "Type_of_order",
    "Type_of_vehicle",
    "Festival",
    "City",
)
COORDINATE_PAIRS = {
    "restaurant": ("Restaurant_latitude", "Restaurant_longitude"),
    "delivery": ("Delivery_location_latitude", "Delivery_location_longitude"),
}
COORDINATE_COLUMNS = tuple(column for pair in COORDINATE_PAIRS.values() for column in pair)
NUMERIC_LITERAL = r"[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?|[+-]?(?:inf(?:inity)?|nan)"


def normalize_text(values: pd.Series, missing_markers: list[str]) -> pd.Series:
    """Trim surrounding whitespace and map configured markers to nullable strings."""
    trimmed = values.astype("string").str.strip()
    return trimmed.mask(trimmed.str.casefold().isin(missing_markers))


def parse_numeric(values: pd.Series) -> tuple[pd.Series, dict[str, pd.Series]]:
    """Parse numeric literals and distinguish missing, malformed and non-finite input."""
    numeric = values.str.casefold().str.fullmatch(NUMERIC_LITERAL, na=False)
    parsed = pd.Series(
        values.where(numeric).to_numpy(dtype=float, na_value=np.nan), index=values.index
    )
    finite = np.isfinite(parsed)
    return parsed.where(finite), {
        "missing": values.isna(),
        "malformed": values.notna() & ~numeric,
        "non_finite": numeric & ~finite,
    }


def parse_delivery_time(values: pd.Series) -> tuple[pd.Series, dict[str, int]]:
    """Accept plain minutes and the '(min)' prefix used by Zomato CSV variants."""
    tokens = values.str.replace(r"(?i)^\(min\)\s*", "", regex=True)
    minutes, issues = parse_numeric(tokens)
    issues["non_positive"] = minutes.le(0)
    return minutes.mask(issues["non_positive"]).astype("Float64"), _counts(issues)


def parse_order_timestamp(
    dates: pd.Series, times: pd.Series
) -> tuple[pd.Series, dict[str, Any]]:
    """Parse DD-MM-YYYY and HH:MM or fractional days, including midnight rollover."""
    date_shape = dates.str.fullmatch(r"[0-9]{2}-[0-9]{2}-[0-9]{4}", na=False)
    day = pd.to_datetime(dates.where(date_shape), format="%d-%m-%Y", errors="coerce")
    clock = pd.to_datetime(
        times.where(times.str.fullmatch(r"[0-9]{2}:[0-9]{2}", na=False)),
        format="%H:%M",
        errors="coerce",
    )
    clock_minutes = clock.dt.hour * 60 + clock.dt.minute

    decimal_shape = times.str.fullmatch(r"[0-9]+(?:\.[0-9]+)?", na=False)
    fractions = pd.to_numeric(times.where(decimal_shape), errors="coerce").astype("float64")
    minute_offsets = fractions * 1440
    whole_minutes = minute_offsets.round()
    valid_fraction = fractions.between(0, 1) & (minute_offsets - whole_minutes).abs().le(1e-5)
    minutes = clock_minutes.fillna(whole_minutes.where(valid_fraction))
    timestamps = day + pd.to_timedelta(minutes, unit="min")
    counts = _counts(
        {
            "missing_date": dates.isna(),
            "invalid_date": dates.notna() & day.isna(),
            "missing_time": times.isna(),
            "invalid_time": times.notna() & minutes.isna(),
            "fractional_day_times": valid_fraction,
            "midnight_rollovers": valid_fraction & fractions.eq(1),
            "null_timestamp": timestamps.isna(),
        }
    )
    return timestamps, {
        **counts,
        "rule": "DD-MM-YYYY with HH:MM or a minute-aligned fraction of a day. "
        "A fraction of 1 denotes 00:00 on the following date. Timestamps use local clock time.",
    }


def haversine_km(coordinates: pd.DataFrame) -> pd.Series:
    """Calculate straight-line great-circle distances using the mean Earth radius."""
    lat1, lon1, lat2, lon2 = np.radians(coordinates[list(COORDINATE_COLUMNS)].to_numpy()).T
    a = np.sin((lat2 - lat1) / 2) ** 2
    a += np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    distance = 2 * 6371.0088 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
    return pd.Series(distance, index=coordinates.index, dtype="Float64")


def clean_coordinates(
    frame: pd.DataFrame, max_distance_km: float
) -> tuple[pd.DataFrame, pd.Series, dict[str, Any]]:
    """Validate coordinate pairs and suppress implausible distances."""
    coordinates = pd.DataFrame(index=frame.index)
    pairs: dict[str, dict[str, int]] = {}
    for endpoint, (latitude, longitude) in COORDINATE_PAIRS.items():
        lat, lat_issues = parse_numeric(frame[latitude])
        lon, lon_issues = parse_numeric(frame[longitude])
        missing = lat_issues["missing"] | lon_issues["missing"]
        malformed = lat_issues["malformed"] | lon_issues["malformed"]
        non_finite = lat_issues["non_finite"] | lon_issues["non_finite"]
        outside = (lat.notna() & ~lat.between(-90, 90)) | (lon.notna() & ~lon.between(-180, 180))
        zero_pair = lat.eq(0) & lon.eq(0)
        invalid = missing | malformed | non_finite | outside | zero_pair
        pairs[endpoint] = _counts(
            {
                "missing_component": missing,
                "malformed_component": malformed,
                "non_finite_component": non_finite,
                "out_of_range": outside,
                "zero_pair": zero_pair,
                "invalid_pair": invalid,
            }
        )
        coordinates[latitude] = lat.mask(invalid)
        coordinates[longitude] = lon.mask(invalid)

    distance = haversine_km(coordinates)
    too_far = distance.gt(max_distance_km).fillna(False)
    valid = distance.mask(too_far)
    report = {
        "description": "Straight-line great-circle distance in kilometers (Haversine).",
        "rule": "Latitude must be within [-90, 90] and longitude within [-180, 180]. "
        "A (0, 0) endpoint is treated as a missing location. An individual zero is allowed. "
        "Distances above the configured maximum are nulled. Source signs are preserved.",
        "coordinate_pair_issues": pairs,
        "rows_with_invalid_coordinate_pair": int(distance.isna().sum()),
        "implausible_distances": int(too_far.sum()),
        "max_plausible_km": max_distance_km,
        "pre_cutoff_km": _numeric_range(distance),
        "retained_km": _numeric_range(valid),
    }
    return coordinates.astype("Float64"), valid, report


def profile_raw(
    raw: pd.DataFrame, normalized: pd.DataFrame, schema: dict[str, Any], quality: dict[str, Any]
) -> dict[str, Any]:
    """Summarize all raw records, including rows subsequently removed."""
    specs = {
        **quality["numeric_fields"],
        **{
            column: {
                "min": -90 if column.endswith("latitude") else -180,
                "max": 90 if column.endswith("latitude") else 180,
                "integer": False,
            }
            for column in COORDINATE_COLUMNS
        },
    }
    columns = {}
    for column, values in normalized.items():
        info: dict[str, Any] = {
            "input_dtype": str(raw[column].dtype),
            "logical_type": "text",
            "missing": int(values.isna().sum()),
            "distinct_non_null": int(values.nunique()),
        }
        if column in CATEGORICAL_COLUMNS:
            info["logical_type"] = "category"
            info["common_values"] = {
                str(value): int(count) for value, count in values.value_counts().head(10).items()
            }
        elif column in specs:
            info["logical_type"] = "numeric"
            numbers, issues = parse_numeric(values)
            info["numeric_range"] = _numeric_range(numbers)
            info["numeric_issues"] = _counts({**issues, **numeric_violations(numbers, specs[column])})
        elif column == schema["raw_target_column"]:
            info["logical_type"] = "duration_minutes"
            tokens = values.str.replace(r"(?i)^\(min\)\s*", "", regex=True)
            numbers, _ = parse_numeric(tokens)
            info["numeric_range"] = _numeric_range(numbers)
            _, info["numeric_issues"] = parse_delivery_time(values)
        elif column in {"Order_Date", "Time_Orderd", "Time_Order_picked"}:
            info["logical_type"] = "date" if column == "Order_Date" else "time"
        elif column in {"ID", "Delivery_person_ID"}:
            info["logical_type"] = "identifier"
        columns[column] = info
    return {"rows": len(raw), "column_count": len(raw.columns), "columns": columns}


def clean_dataset(
    raw: pd.DataFrame, schema: dict[str, Any], quality: dict[str, Any]
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Clean records and return a reconciled report for this ingestion run."""
    normalized = raw.apply(normalize_text, missing_markers=quality["missing_markers"])
    exact_duplicates = raw.duplicated(keep="first")
    order_ids = normalized["ID"]
    raw_repeated_ids = order_ids[order_ids.notna() & order_ids.duplicated(keep=False)]
    unique = normalized.loc[~exact_duplicates]
    unique_ids = unique["ID"]
    conflicts = unique_ids.notna() & unique_ids.duplicated(keep=False)
    minutes, rejections = parse_delivery_time(unique[schema["raw_target_column"]])
    retained = unique.loc[minutes.notna()]

    cleaned = retained[["ID", "Delivery_person_ID"]].copy()
    cleaned["order_id_conflict"] = conflicts.loc[retained.index]
    for column in CATEGORICAL_COLUMNS:
        categories = retained[column].str.casefold()
        if column == "City":
            categories = categories.replace({"metropolitian": "metropolitan"}).str.title()
        cleaned[column] = categories

    numeric_quality = {}
    for column, rule in quality["numeric_fields"].items():
        values, issues = parse_numeric(retained[column])
        violations = numeric_violations(values, rule)
        invalid = violations["out_of_range"] | violations["not_integer"]
        cleaned[column] = values.mask(invalid).astype("Int64" if rule["integer"] else "Float64")
        numeric_quality[column] = {"rule": rule, **_counts({**issues, **violations})}
    numeric_quality["Delivery_person_Age"]["under_18_review"] = int(
        cleaned["Delivery_person_Age"].lt(18).sum()
    )

    timestamp, timestamp_report = parse_order_timestamp(retained["Order_Date"], retained["Time_Orderd"])
    cleaned["order_timestamp"] = timestamp
    cleaned["order_hour"] = timestamp.dt.hour.astype("Int64")
    cleaned["order_day_of_week"] = timestamp.dt.dayofweek.astype("Int64")
    coordinates, distance, distance_report = clean_coordinates(
        retained, quality["max_straight_line_distance_km"]
    )
    cleaned = cleaned.join(coordinates)
    cleaned["distance_km"] = distance

    target_column = schema["target_column"]
    cleaned[target_column] = minutes.loc[retained.index]
    long_delivery = cleaned[target_column].gt(quality["long_delivery_review_minutes"])
    cleaned["long_delivery_review"] = long_delivery
    cleaned = cleaned.reset_index(drop=True)

    report = {
        "input_rows": len(raw),
        "output_rows": len(cleaned),
        "raw_profile": profile_raw(raw, normalized, schema, quality),
        "duplicates": {
            "exact_rows_removed": int(exact_duplicates.sum()),
            "raw_repeated_order_ids": int(raw_repeated_ids.nunique()),
            "raw_rows_with_repeated_order_ids": len(raw_repeated_ids),
            "conflicting_order_ids": int(unique_ids.where(conflicts).nunique()),
            "rows_with_conflicting_order_ids": int(conflicts.sum()),
            "retained_conflicting_order_rows": int(cleaned["order_id_conflict"].sum()),
            "policy": "Keep the first exact CSV record. Flag distinct records with the same "
            "trimmed, nonmissing ID and retain all with valid targets for audit.",
        },
        "target_rejections": rejections,
        "target_review": {
            "rule": "Flag valid durations above the configured threshold and retain the rows.",
            "threshold_minutes": quality["long_delivery_review_minutes"],
            "long_deliveries": int(long_delivery.sum()),
        },
        "numeric_features_quality": numeric_quality,
        "timestamps": timestamp_report,
        "distance": distance_report,
        "remaining_null_counts": {column: int(count) for column, count in cleaned.isna().sum().items()},
        "final_schema": {
            "target_column": target_column,
            "feature_allowlist": schema["feature_allowlist"],
            "column_types": {column: str(dtype) for column, dtype in cleaned.dtypes.items()},
            "order_day_of_week_convention": "Monday=0, Sunday=6",
        },
        "cleaning_policy": {
            "missing_markers": quality["missing_markers"],
            "categories": "Trim and lowercase categories. City labels use title case and "
            "Metropolitian is mapped to Metropolitan.",
            "issue_count_population": "Feature issues are counted on rows with valid targets "
            "after exact deduplication. Coordinate-pair reasons can overlap. "
            "Target rejections are mutually exclusive and counted after exact deduplication.",
            "availability": "Rider, vehicle, batching, weather and traffic fields are audit "
            "columns pending confirmation of order-time availability. Pickup time is excluded.",
        },
    }
    return cleaned, report


def _counts(masks: dict[str, pd.Series]) -> dict[str, int]:
    return {reason: int(mask.sum()) for reason, mask in masks.items()}


def _numeric_range(values: pd.Series) -> dict[str, float | None]:
    return {
        label: float(value) if pd.notna(value) else None
        for label, value in {
            "min": values.min(),
            "median": values.median(),
            "max": values.max(),
        }.items()
    }


def build_preprocessor(schema_config: dict[str, Any]) -> Any:
    """Reserve learned preprocessing for the future training pipeline."""
    raise NotImplementedError("Fit learned feature transformations during model training.")
