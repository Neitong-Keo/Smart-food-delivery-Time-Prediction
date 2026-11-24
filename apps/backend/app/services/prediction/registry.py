"""Every model the API can serve, so the app can compare them for the same order.

`ml.scripts.train_models` saves the selected pipeline as `model.joblib` and each
refitted candidate under `models/<id>.joblib`. The selected model is always served
from `model.joblib`, so a deployment that only has that file keeps working.
"""

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.services.prediction.base import Predictor
from app.services.prediction.demo import DemoPredictor
from app.services.prediction.model import TrainedModelPredictor
from ml.manifest import resolve_dataset_paths

logger = logging.getLogger(__name__)

# Display order in the app: simplest first.
MODEL_CATALOG: tuple[tuple[str, str], ...] = (
    ("median", "Median baseline"),
    ("decision_tree", "Decision Tree"),
    ("xgboost", "XGBoost"),
)
CATALOG_NAMES = dict(MODEL_CATALOG)
DEMO_MODEL_ID = "demo"
FALLBACK_MODEL_ID = "model"


class UnknownModelError(LookupError):
    """The requested model id isn't served by this API."""


@dataclass(frozen=True)
class ServedModel:
    """One predictor and the scores recorded when it was trained."""

    id: str
    name: str
    predictor: Predictor
    selected: bool
    validation: dict[str, float] | None = None
    test: dict[str, float] | None = None


@dataclass(frozen=True)
class ModelRegistry:
    """The served models in display order. Exactly one is selected."""

    models: tuple[ServedModel, ...]

    @property
    def selected(self) -> ServedModel:
        return next(model for model in self.models if model.selected)

    @property
    def ids(self) -> list[str]:
        return [model.id for model in self.models]

    def get(self, model_id: str | None) -> ServedModel:
        """Return the named model, or the selected one when no id is given."""
        if model_id is None:
            return self.selected
        for model in self.models:
            if model.id == model_id:
                return model
        raise UnknownModelError(
            f"Unknown model '{model_id}'. Choose one of: {', '.join(self.ids)}."
        )


def _read_manifest(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _scores(values: Any) -> dict[str, float] | None:
    if not isinstance(values, dict):
        return None
    scores = {
        str(key): float(value)
        for key, value in values.items()
        if isinstance(value, (int, float)) and not isinstance(value, bool)
    }
    return scores or None


def _selected_id(manifest: dict[str, Any]) -> str:
    selected = manifest.get("selected_model_id")
    if isinstance(selected, str) and selected:
        return selected
    by_name = {name: model_id for model_id, name in MODEL_CATALOG}
    return by_name.get(str(manifest.get("model_name")), FALLBACK_MODEL_ID)


def _recorded_scores(
    manifest: dict[str, Any], model_id: str, name: str, selected: bool
) -> tuple[dict[str, float] | None, dict[str, float] | None]:
    """Read validation and test scores, including from manifests written before `models` existed."""
    entry = (manifest.get("models") or {}).get(model_id)
    if isinstance(entry, dict):
        return _scores(entry.get("validation")), _scores(entry.get("test"))
    validation = _scores((manifest.get("validation") or {}).get(name))
    test = _scores(manifest.get("test")) if selected else None
    return validation, test


def create_model_registry(mode: str, model_path: str | None = None) -> ModelRegistry:
    """Load every available model, failing at startup on an unknown mode."""
    if mode == "demo":
        return ModelRegistry((ServedModel(DEMO_MODEL_ID, "Demo rule", DemoPredictor(), selected=True),))
    if mode != "model":
        raise ValueError(f"Unknown PREDICTION_MODE '{mode}'. Use 'demo' or 'model'.")

    paths = resolve_dataset_paths()
    selected_path = Path(model_path) if model_path else paths.model_artifact
    artifacts_dir = selected_path.parent
    manifest = _read_manifest(
        artifacts_dir / "manifest.json" if model_path else paths.model_manifest
    )
    models_dir = artifacts_dir / "models" if model_path else paths.models_dir
    selected_id = _selected_id(manifest)
    selected_predictor = TrainedModelPredictor(selected_path)

    served: list[ServedModel] = []
    for model_id, name in MODEL_CATALOG:
        selected = model_id == selected_id
        if selected:
            predictor: Predictor = selected_predictor
        elif (models_dir / f"{model_id}.joblib").is_file():
            predictor = TrainedModelPredictor(models_dir / f"{model_id}.joblib")
        else:
            continue
        validation, test = _recorded_scores(manifest, model_id, name, selected)
        served.append(ServedModel(model_id, name, predictor, selected, validation, test))

    if not any(model.selected for model in served):
        name = CATALOG_NAMES.get(selected_id) or str(manifest.get("model_name") or "Trained model")
        validation, test = _recorded_scores(manifest, selected_id, name, True)
        served.append(ServedModel(selected_id, name, selected_predictor, True, validation, test))

    logger.info("Serving models: %s (selected: %s)", ", ".join(m.id for m in served), selected_id)
    return ModelRegistry(tuple(served))
