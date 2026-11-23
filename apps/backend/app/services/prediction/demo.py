"""Placeholder predictor for testing the workflow before a model exists.

This is a fixed rule, not machine learning. Its output is always returned with
`model_status: "demo"`. The constants place a typical road distance in the
dataset preview (about 12 km) at the dataset's median delivery time (26 minutes).
"""

from typing import Literal

from app.services.prediction.features import DeliveryFeatures
from app.services.prediction.serving import load_serving_limits

DEMO_BASE_MINUTES = 15
DEMO_MINUTES_PER_ROAD_KM = 0.9


class DemoPredictor:
    """Return a fixed base time plus an allowance per road kilometer."""

    status: Literal["demo"] = "demo"
    detail: str | None = None

    def __init__(self) -> None:
        self.feature_columns = load_serving_limits().model_features

    def predict(self, features: DeliveryFeatures) -> float:
        return DEMO_BASE_MINUTES + DEMO_MINUTES_PER_ROAD_KM * features.road_distance_km
