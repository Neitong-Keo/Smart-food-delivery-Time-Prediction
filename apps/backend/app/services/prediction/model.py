"""Serve predictions from the fitted scikit-learn pipeline.

Save the pipeline to `ml/artifacts/v1/model.joblib` and start the API with
`PREDICTION_MODE=model`. See `docs/ml-integration.md`.
"""

import json
import logging
from pathlib import Path
from typing import Any, Literal

from app.services.prediction.base import PredictionUnavailableError
from app.services.prediction.features import SUPPORTED_MODEL_COLUMNS, DeliveryFeatures
from app.services.prediction.serving import load_serving_limits
from ml.manifest import resolve_dataset_paths

logger = logging.getLogger(__name__)

# Nullable dtypes used by the cleaned and route-enriched Parquet files.
MODEL_INPUT_DTYPES = {
    "Type_of_order": "string",
    "Festival": "string",
    "City": "string",
    "order_hour": "Int64",
    "order_day_of_week": "Int64",
    "road_distance_km": "Float64",
    "route_duration_minutes": "Float64",
}


def _load_pipeline(path: Path) -> tuple[Any, tuple[str, ...]]:
    """Load a pipeline and confirm the API can supply every column it expects."""
    if not path.is_file():
        raise PredictionUnavailableError(f"Model file not found at {path}.")

    import joblib

    try:
        pipeline = joblib.load(path)
    except Exception as error:
        raise PredictionUnavailableError(f"Model file at {path} could not be loaded: {error}") from error

    if not callable(getattr(pipeline, "predict", None)):
        raise PredictionUnavailableError(f"The object in {path} has no predict method.")

    trained_columns = getattr(pipeline, "feature_names_in_", None)
    columns = (
        tuple(str(column) for column in trained_columns)
        if trained_columns is not None
        else load_serving_limits().model_features
    )
    if "distance_km" in columns:
        raise PredictionUnavailableError(
            "The model was trained on straight-line distance_km. "
            "Retrain it on road_distance_km from dataset_with_routes.parquet."
        )
    unsupported = sorted(set(columns) - SUPPORTED_MODEL_COLUMNS)
    if unsupported:
        raise PredictionUnavailableError(
            f"The model expects columns the API cannot supply: {', '.join(unsupported)}. "
            "Add them in app/services/prediction/features.py."
        )
    return pipeline, columns


class TrainedModelPredictor:
    """Predict with the saved pipeline, or report why it is unavailable."""

    def __init__(self, model_path: Path | None = None) -> None:
        self.status: Literal["live", "unavailable"] = "unavailable"
        self.detail: str | None = None
        self.feature_columns: tuple[str, ...] = load_serving_limits().model_features
        self._pipeline: Any = None

        path = model_path or resolve_dataset_paths().model_artifact
        try:
            self._pipeline, self.feature_columns = _load_pipeline(path)
            self.status = "live"
            logger.info("Loaded model from %s", path)
        except PredictionUnavailableError as error:
            self.detail = str(error)
            logger.error("Trained model unavailable: %s", error)

    def predict(self, features: DeliveryFeatures) -> float:
        if self._pipeline is None:
            raise PredictionUnavailableError(self.detail or "The trained model is unavailable.")

        import pandas as pd

        row = features.to_model_input(self.feature_columns)
        frame = pd.DataFrame([row], columns=list(self.feature_columns)).astype(
            {column: MODEL_INPUT_DTYPES[column] for column in self.feature_columns}
        )
        try:
            return float(self._pipeline.predict(frame)[0])
        except Exception as error:
            logger.exception("Model prediction failed")
            raise PredictionUnavailableError("The trained model could not score this order.") from error


def load_model_metrics(path: Path | None = None) -> dict[str, str | float] | None:
    """Read scalar values from metrics.json, if the training run saved one."""
    metrics_path = path or resolve_dataset_paths().metrics_artifact
    try:
        data = json.loads(metrics_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    scalars = {
        str(key): value
        for key, value in data.items()
        if isinstance(value, (str, int, float)) and not isinstance(value, bool)
    }
    return scalars or None
