"""Export a model-ready snapshot of the chronological partitions."""

from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
import pandas as pd

from ml import DEFAULT_DATASET_CONFIG_PATH
from ml.manifest import load_dataset_config, resolve_dataset_paths
from ml.pipeline import build_preprocessor
from ml.train import TIMESTAMP_COLUMN, ChronologicalSplit, split_routed_orders

PARTITION_COLUMN = "split"


def prepare_partitions(
    split: ChronologicalSplit,
    features: list[str],
    target: str,
) -> pd.DataFrame:
    """Fit on training features and transform all three partitions with that fit."""
    preprocessor = build_preprocessor(features).fit(split.train[features])
    encoded_features = preprocessor.get_feature_names_out()

    partitions = (
        ("train", split.train),
        ("validation", split.validation),
        ("test", split.test),
    )
    prepared = []

    for name, orders in partitions:
        values = preprocessor.transform(orders[features])

        if not np.isfinite(values).all():
            raise ValueError(f"Preprocessing produced non-finite values in the {name} partition.")

        frame = pd.DataFrame(values, columns=encoded_features)
        frame.insert(0, PARTITION_COLUMN, name)
        frame.insert(1, TIMESTAMP_COLUMN, orders[TIMESTAMP_COLUMN].array)
        frame.insert(2, target, orders[target].to_numpy(dtype=float))
        prepared.append(frame)

    return pd.concat(prepared, ignore_index=True)


def run_preparation(config_path: Path = DEFAULT_DATASET_CONFIG_PATH) -> Path:
    """Read the routed dataset and atomically replace the prepared Parquet export."""
    config = load_dataset_config(config_path)
    paths = resolve_dataset_paths(config_path)
    destination = paths.prepared_parquet

    if destination.resolve() in {paths.routed_parquet.resolve(), paths.processed_parquet.resolve()}:
        raise ValueError("The prepared data must use a path distinct from its source datasets.")

    if not paths.routed_parquet.is_file():
        raise FileNotFoundError(
            f"Missing '{paths.routed_parquet}'. Run 'python -m ml.scripts.enrich_routes' first."
        )

    serving = config["serving"]
    features = serving["model_features"]
    target = config["schema"]["target_column"]

    if target in features or "road_distance_km" not in features:
        raise ValueError("Use road_distance_km as a feature and keep delivery time as the target.")

    records = pd.read_parquet(
        paths.routed_parquet,
        columns=["ID", TIMESTAMP_COLUMN, target, *features],
    )
    routed = split_routed_orders(records, target, serving["blocked_road_distance_km"])
    prepared = prepare_partitions(routed.split, features, target)

    destination.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=".prepare-", dir=destination.parent) as temporary:
        staged = Path(temporary) / destination.name
        prepared.to_parquet(staged, index=False)

        if not pd.read_parquet(staged).equals(prepared):
            raise ValueError("Parquet round trip did not preserve the prepared dataset.")

        staged.replace(destination)

    return destination
