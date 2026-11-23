"""Interface shared by the demo predictor and the trained model."""

from collections.abc import Sequence
from typing import Protocol

from app.schemas.prediction import ModelAvailability
from app.services.prediction.features import DeliveryFeatures


class PredictionUnavailableError(RuntimeError):
    """The configured predictor cannot produce a result."""


class Predictor(Protocol):
    """Turn delivery features into a total delivery time in minutes."""

    status: ModelAvailability
    detail: str | None
    feature_columns: Sequence[str]

    def predict(self, features: DeliveryFeatures) -> float: ...
