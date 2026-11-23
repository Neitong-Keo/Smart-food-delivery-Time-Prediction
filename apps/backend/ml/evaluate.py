"""Regression metrics for delivery times measured in minutes."""

from typing import Any

from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error


def evaluate_predictions(y_true: Any, y_pred: Any) -> dict[str, float]:
    """Return MAE, RMSE, and R² for the same set of orders."""
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(root_mean_squared_error(y_true, y_pred)),
        "r2": float(r2_score(y_true, y_pred)),
    }

