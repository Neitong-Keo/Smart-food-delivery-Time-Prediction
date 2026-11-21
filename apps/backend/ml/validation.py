"""Validate the input CSV, cleaned data, and order-time feature selection."""

import csv
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


ORDER_PLACEMENT_FEATURES = frozenset(
    {"Type_of_order", "Festival", "City", "order_hour", "order_day_of_week", "distance_km"}
)


def read_raw_csv(path: Path, required_columns: list[str]) -> pd.DataFrame:
    """Read CSV records losslessly as strings after validating the source header."""
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle, strict=True)
        header = next(reader, None)
        if not header:
            raise ValueError("CSV is empty or has no header.")
        columns = [column.strip() for column in header]
        collisions = [name for name, count in Counter(columns).items() if count > 1]
        if collisions:
            names = ", ".join(map(repr, collisions))
            raise ValueError(f"CSV headers collide after trimming whitespace: {names}")
        if "" in columns:
            raise ValueError("CSV contains a blank header.")
        missing = sorted(set(required_columns) - set(columns))
        if missing:
            raise ValueError(f"Missing required CSV columns: {', '.join(missing)}")

        rows = []
        for row in reader:
            if not row:
                continue
            if len(row) != len(columns):
                raise ValueError(
                    f"CSV record ending on line {reader.line_num} has {len(row)} fields. "
                    f"Expected {len(columns)}."
                )
            rows.append(row)
    return pd.DataFrame(rows, columns=columns, dtype="string")


def validate_feature_allowlist(features: list[str]) -> None:
    """Require an explicit list of fields confirmed available at order placement."""
    if not isinstance(features, list) or not features or not all(
        isinstance(feature, str) for feature in features
    ):
        raise ValueError("feature_allowlist must be a nonempty list of column names.")
    if len(features) != len(set(features)):
        raise ValueError("feature_allowlist contains duplicate column names.")
    unsafe = sorted(set(features) - ORDER_PLACEMENT_FEATURES)
    if unsafe:
        raise ValueError(f"Features unavailable at order placement: {', '.join(unsafe)}")


def numeric_violations(values: pd.Series, rule: dict[str, Any]) -> dict[str, pd.Series]:
    """Identify finite values outside an inclusive range or requiring an integer."""
    out_of_range = values.notna() & ~values.between(rule["min"], rule["max"])
    fractional = values.notna() & ~out_of_range & values.mod(1).ne(0)
    return {
        "out_of_range": out_of_range,
        "not_integer": fractional & rule["integer"],
    }


def validate_dataset(
    records: pd.DataFrame, target_column: str, features: list[str]
) -> None:
    """Enforce the target and feature contracts on a cleaned dataset."""
    validate_feature_allowlist(features)
    if target_column in features:
        raise ValueError("The target column must be excluded from feature_allowlist.")
    missing = sorted(set([target_column, *features]) - set(records.columns))
    if missing:
        raise ValueError(f"Missing cleaned columns: {', '.join(missing)}")
    if not pd.api.types.is_numeric_dtype(records[target_column]):
        raise ValueError("Cleaned delivery times must be numeric.")
    targets = records[target_column].to_numpy(dtype=float, na_value=np.nan)
    if not (np.isfinite(targets) & (targets > 0)).all():
        raise ValueError("Cleaned delivery times must be finite and positive.")
