"""Chronological dataset splitting and median-baseline evaluation."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.dummy import DummyRegressor
from sklearn.metrics import mean_absolute_error

from ml import DEFAULT_DATASET_CONFIG_PATH
from ml.manifest import load_dataset_config, resolve_dataset_paths
from ml.validation import validate_dataset


TIMESTAMP_COLUMN = "order_timestamp"


@dataclass(frozen=True)
class ChronologicalSplit:
    """Chronological partitions and the counts excluded before splitting."""

    train: pd.DataFrame
    validation: pd.DataFrame
    test: pd.DataFrame
    missing_timestamps: int
    invalid_timestamps: int

    def summary(self) -> pd.DataFrame:
        """Report sizes, shares of usable rows, and inclusive timestamp ranges."""
        partitions = {"Training": self.train, "Validation": self.validation, "Test": self.test}
        usable_rows = sum(len(partition) for partition in partitions.values())
        return pd.DataFrame.from_dict(
            {
                name: {
                    "Rows": len(partition),
                    "Share (%)": round(100 * len(partition) / usable_rows, 2),
                    "First order": partition[TIMESTAMP_COLUMN].iloc[0],
                    "Last order": partition[TIMESTAMP_COLUMN].iloc[-1],
                }
                for name, partition in partitions.items()
            },
            orient="index",
        )


@dataclass(frozen=True)
class BaselineResult:
    """Median-baseline metrics and the partitions used for the run."""

    split: ChronologicalSplit
    feature_columns: tuple[str, ...]
    target_column: str
    training_median: float
    validation_mae: float


def split_chronologically(records: pd.DataFrame) -> ChronologicalSplit:
    """Choose cut points near 70% and 85% without dividing timestamp groups."""
    if TIMESTAMP_COLUMN not in records.columns:
        raise ValueError(f"Cleaned dataset is missing the timestamp column '{TIMESTAMP_COLUMN}'.")

    source = records[TIMESTAMP_COLUMN]
    if pd.api.types.is_datetime64_any_dtype(source):
        timestamps = source
    else:
        # Parse legacy text timestamps in ISO 8601 form.
        source = source.astype("string").str.strip().replace("", pd.NA)
        date_time = source.str.match(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}")
        timestamps = pd.to_datetime(
            source.where(date_time), format="ISO8601", errors="coerce", utc=True
        )

    missing = int(source.isna().sum())
    invalid = int((source.notna() & timestamps.isna()).sum())
    ordered = (
        records.assign(**{TIMESTAMP_COLUMN: timestamps})
        .loc[timestamps.notna()]
        .sort_values(TIMESTAMP_COLUMN, kind="stable")
    )
    group_ends = ordered.groupby(TIMESTAMP_COLUMN, sort=False).size().cumsum().to_numpy()
    if len(group_ends) < 3:
        raise ValueError(
            f"Chronological split requires at least three distinct valid order timestamps. "
            f"Found {len(group_ends)} after excluding {missing} missing and {invalid} invalid timestamps."
        )

    # Exclude boundaries that would leave an empty validation or test partition.
    train_group = int(np.abs(100 * group_ends[:-2] - 70 * len(ordered)).argmin())
    train_end = group_ends[train_group]
    validation_choices = group_ends[train_group + 1 : -1]
    validation_end = validation_choices[
        np.abs(100 * validation_choices - 85 * len(ordered)).argmin()
    ]

    return ChronologicalSplit(
        train=ordered.iloc[:train_end],
        validation=ordered.iloc[train_end:validation_end],
        test=ordered.iloc[validation_end:],
        missing_timestamps=missing,
        invalid_timestamps=invalid,
    )


def fit_median_baseline(
    records: pd.DataFrame, feature_columns: list[str], target_column: str
) -> BaselineResult:
    """Fit the training median and score predictions on validation orders."""
    validate_dataset(records, target_column, feature_columns)
    split = split_chronologically(records)
    model = DummyRegressor(strategy="median")
    model.fit(split.train[feature_columns], split.train[target_column])
    predictions = model.predict(split.validation[feature_columns])

    return BaselineResult(
        split=split,
        feature_columns=tuple(feature_columns),
        target_column=target_column,
        training_median=float(model.constant_[0, 0]),
        validation_mae=float(mean_absolute_error(split.validation[target_column], predictions)),
    )


def run_training(config_path: Path = DEFAULT_DATASET_CONFIG_PATH) -> BaselineResult:
    """Load the configured Parquet and run the median baseline."""
    schema = load_dataset_config(config_path)["schema"]
    path = resolve_dataset_paths(config_path).processed_parquet
    if not path.is_file():
        raise FileNotFoundError(
            f"Cleaned Parquet is missing at '{path}'. Run 'python -m ml.scripts.ingest' first."
        )
    records = pd.read_parquet(path)
    return fit_median_baseline(records, schema["feature_allowlist"], schema["target_column"])
