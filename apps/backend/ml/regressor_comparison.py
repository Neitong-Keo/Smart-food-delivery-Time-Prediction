"""Compare a median baseline, linear regression, and random forest on delivery ETAs."""

import json
from functools import partial
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression

from ml import ML_BASE_DIR
from ml.model_training import MEDIAN_BASELINE, SEED, Candidate, run_model_training

OUTPUT_DIR = ML_BASE_DIR / "experiments" / "linear-random-forest"
COMPARISON_CANDIDATES = (
    MEDIAN_BASELINE,
    Candidate(
        "linear_regression",
        "Linear Regression",
        LinearRegression,
        {"positive": [False, True]},
    ),
    Candidate(
        "random_forest",
        "Random Forest",
        partial(RandomForestRegressor, n_jobs=4, random_state=SEED),
        {
            "max_depth": [8, 16],
            "min_samples_leaf": [5, 20],
            "n_estimators": [100, 200],
        },
    ),
)


def pearson_r(actual: pd.Series, predicted: pd.Series) -> float | None:
    """A constant prediction or target has no defined Pearson correlation."""
    if actual.nunique() < 2 or predicted.nunique() < 2:
        return None

    return float(actual.corr(predicted))


def compare_regressors(output_dir: Path = OUTPUT_DIR) -> pd.DataFrame:
    """Fit all three pipelines and export tables and charts for the experiment."""
    report = run_model_training(candidates=COMPARISON_CANDIDATES, output_dir=output_dir)
    predictions = pd.read_csv(output_dir / "test_predictions.csv")
    actual = predictions["actual_minutes"]

    summary_rows = []
    error_rows = []
    groups = pd.cut(
        actual,
        [-np.inf, 20, 30, 40, np.inf],
        labels=["Under 20", "20 to under 30", "30 to under 40", "40 and over"],
        right=False,
    )

    for model_id, model in report["models"].items():
        predicted = predictions[f"predicted_{model_id}"]
        errors = predicted - actual

        summary_rows.append(
            {
                "model": model["name"],
                "selected": model["selected"],
                **{f"validation_{metric}": value for metric, value in model["validation"].items()},
                **{f"test_{metric}": value for metric, value in model["test"].items()},
                "test_pearson_r": pearson_r(actual, predicted),
                "test_p90_absolute_error_minutes": float(errors.abs().quantile(0.9)),
                "parameters": json.dumps(model["parameters"], sort_keys=True),
            }
        )

        for duration, bucket in errors.groupby(groups, observed=True):
            error_rows.append(
                {
                    "model": model["name"],
                    "actual_minutes_group": duration,
                    "test_orders": len(bucket),
                    "mae_minutes": bucket.abs().mean(),
                    "mean_signed_error_minutes": bucket.mean(),
                }
            )

    summary = pd.DataFrame(summary_rows)
    summary.to_csv(output_dir / "comparison.csv", index=False, float_format="%.6f")
    pd.DataFrame(error_rows).to_csv(
        output_dir / "test_errors_by_duration.csv",
        index=False,
        float_format="%.6f",
    )

    _save_comparison_charts(predictions, report["models"], output_dir)

    return summary


def _save_comparison_charts(
    predictions: pd.DataFrame,
    models: dict[str, dict[str, Any]],
    output_dir: Path,
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    from matplotlib import pyplot as plt

    actual = predictions["actual_minutes"]
    predicted = predictions[[f"predicted_{model_id}" for model_id in models]]
    errors = predicted.sub(actual, axis=0)
    limits = [min(actual.min(), predicted.min().min()), max(actual.max(), predicted.max().max())]
    extent = max(1, abs(errors.to_numpy()).max())
    bins = np.linspace(-extent, extent, 41)
    colors = ("#64748b", "#2563a6", "#087f70")

    figure, axes = plt.subplots(
        2,
        len(models),
        figsize=(12, 7.2),
        layout="constrained",
        sharex="row",
        sharey="row",
    )
    figure.suptitle("Delivery estimates on the chronological test set", fontsize=15)

    for index, (model_id, model) in enumerate(models.items()):
        column = f"predicted_{model_id}"
        color = colors[index]
        scatter, histogram = axes[:, index]
        scatter.scatter(actual, predicted[column], color=color, s=9, alpha=0.16, linewidths=0)
        scatter.plot(limits, limits, "--", color="#475569", linewidth=1, label="Perfect estimate")
        scatter.set(
            xlabel="Actual minutes",
            title=f"{model['name']}\nMAE {model['test']['mae']:.2f} min",
        )
        scatter.set_aspect("equal", adjustable="box")

        histogram.hist(errors[column], bins=bins, color=color)
        histogram.axvline(0, color="#475569", linestyle="--", linewidth=1)
        histogram.set_xlabel("Prediction minus actual (min)")

    axes[0, 0].set_ylabel("Predicted minutes")
    axes[0, 0].legend(loc="upper left", frameon=False, fontsize=8)
    axes[1, 0].set_ylabel("Test orders")
    figure.savefig(output_dir / "comparison.png", dpi=160)
    plt.close(figure)

    importance = pd.DataFrame(
        {
            model["name"]: model["validation_feature_importance_mae_increase"]
            for model in models.values()
            if "validation_feature_importance_mae_increase" in model
        }
    )
    selected_name = next(model["name"] for model in models.values() if model["selected"])
    importance = importance.sort_values(selected_name)

    figure, axis = plt.subplots(figsize=(8.2, 4.4), layout="constrained")
    importance.plot.barh(ax=axis, color=colors[1:], width=0.74, rot=0)
    axis.axvline(0, color="#475569", linewidth=1)
    axis.set(
        title="Permutation importance on the validation set",
        xlabel="Increase in MAE after shuffling one feature (min)",
    )
    axis.legend(frameon=False)
    figure.savefig(output_dir / "feature_importance.png", dpi=160)
    plt.close(figure)
