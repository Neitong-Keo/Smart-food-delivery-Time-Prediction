"""Select the predictors named by the PREDICTION_MODE setting."""

from app.services.prediction.base import Predictor
from app.services.prediction.registry import ModelRegistry, create_model_registry


def create_predictor(mode: str, model_path: str | None = None) -> Predictor:
    """Build the selected predictor, failing at startup on an unknown mode."""
    return create_model_registry(mode, model_path).selected.predictor


__all__ = ["ModelRegistry", "create_model_registry", "create_predictor"]
