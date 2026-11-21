"""Model evaluation metrics helpers (Phase 1 scaffold)."""

from typing import Any


def evaluate_predictions(y_true: Any, y_pred: Any) -> dict[str, float]:
    """Compute regression metrics (e.g., MAE, RMSE, R2) for delivery time predictions."""
    raise NotImplementedError(
        "Model evaluation is scaffolded in Phase 1 and will be implemented in Phase 2."
    )

