"""Select the predictor named by the PREDICTION_MODE setting."""

from pathlib import Path

from app.services.prediction.base import Predictor
from app.services.prediction.demo import DemoPredictor
from app.services.prediction.model import TrainedModelPredictor


def create_predictor(mode: str, model_path: str | None = None) -> Predictor:
    """Build a predictor, failing at startup on an unknown mode."""
    if mode == "demo":
        return DemoPredictor()
    if mode == "model":
        return TrainedModelPredictor(Path(model_path) if model_path else None)
    raise ValueError(f"Unknown PREDICTION_MODE '{mode}'. Use 'demo' or 'model'.")
