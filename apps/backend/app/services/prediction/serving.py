"""Live prediction settings, loaded from the `serving` section of dataset.yaml."""

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from ml import DEFAULT_DATASET_CONFIG_PATH
from ml.manifest import load_dataset_config


@dataclass(frozen=True)
class ServingLimits:
    """Model columns and the road distance and time ranges it supports."""

    model_features: tuple[str, ...]
    training_min_km: float
    training_max_km: float
    blocked_min_km: float
    blocked_max_km: float
    supported_order_hours: frozenset[int]


@lru_cache
def load_serving_limits(config_path: Path = DEFAULT_DATASET_CONFIG_PATH) -> ServingLimits:
    """Read and validate the configured limits."""
    serving = load_dataset_config(config_path)["serving"]
    limits = ServingLimits(
        model_features=tuple(serving["model_features"]),
        training_min_km=float(serving["training_road_distance_km"]["min"]),
        training_max_km=float(serving["training_road_distance_km"]["max"]),
        blocked_min_km=float(serving["blocked_road_distance_km"]["min"]),
        blocked_max_km=float(serving["blocked_road_distance_km"]["max"]),
        supported_order_hours=frozenset(int(hour) for hour in serving["supported_order_hours"]),
    )
    if not (
        0 <= limits.blocked_min_km
        <= limits.training_min_km
        < limits.training_max_km
        <= limits.blocked_max_km
    ):
        raise ValueError("serving road distance limits in dataset.yaml are out of order.")
    return limits
