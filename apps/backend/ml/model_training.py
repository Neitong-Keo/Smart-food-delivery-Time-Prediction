"""Train, compare, and export road-distance ETA regression models."""

import hashlib
import json
import os
from collections.abc import Callable
from dataclasses import dataclass
from functools import partial
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.dummy import DummyRegressor
from sklearn.inspection import permutation_importance
from sklearn.model_selection import ParameterGrid
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeRegressor
from xgboost import XGBRegressor

from ml import DEFAULT_DATASET_CONFIG_PATH
from ml.evaluate import evaluate_predictions
from ml.manifest import load_dataset_config, resolve_dataset_paths
from ml.pipeline import build_training_pipeline
from ml.train import TIMESTAMP_COLUMN, split_chronologically

SEED = 42
BASELINE_NAME = "Median baseline"
# Stable identifiers used for saved files and by the API's model picker.
MODEL_IDS = {BASELINE_NAME: "median", "Decision Tree": "decision_tree", "XGBoost": "xgboost"}


def _median_regressor(random_state: int | None = None, **parameters: Any) -> DummyRegressor:
    """Build the baseline with the same call signature as the tuned candidates."""
    return DummyRegressor(**parameters)


@dataclass(frozen=True)
class Candidate:
    name: str
    estimator: Callable[..., Any]
    grid: dict[str, list[Any]]


CANDIDATES = (
    Candidate(BASELINE_NAME, _median_regressor, {"strategy": ["median"]}),
    Candidate("Decision Tree", DecisionTreeRegressor, {"max_depth": [3, 5, 8], "min_samples_leaf": [20, 80]}),
    Candidate(
        "XGBoost",
        partial(XGBRegressor, n_jobs=2),
        {"max_depth": [3, 5], "learning_rate": [0.03, 0.1], "n_estimators": [150, 300]},
    ),
)


@dataclass(frozen=True)
class TrainingResult:
    """Every refitted candidate, the training report, and per-order test predictions."""

    selected: Pipeline
    pipelines: dict[str, Pipeline]
    report: dict[str, Any]
    test_predictions: pd.DataFrame


def _build(candidate: Candidate, features: list[str], parameters: dict[str, Any]) -> Pipeline:
    return build_training_pipeline(features, candidate.estimator(random_state=SEED, **parameters))


def fit_models(
    records: pd.DataFrame, features: list[str], target: str, distance_limits: dict[str, float]
) -> TrainingResult:
    """Tune each candidate on validation, refit all of them, and score them on newer orders.

    The model with the lowest validation MAE (excluding the median baseline) is selected.
    Every candidate is then refitted on training + validation orders with its best
    settings and evaluated once on the test orders, so the app can compare them.
    """
    required = {target, "road_distance_km", *features}
    missing = sorted(required - set(records.columns))
    if missing:
        raise ValueError(f"Route-enriched dataset is missing columns: {', '.join(missing)}.")
    if target in features or "road_distance_km" not in features:
        raise ValueError("Use road_distance_km as a feature and keep delivery time as the target.")

    distances = records["road_distance_km"]
    eligible = records.loc[distances.between(distance_limits["min"], distance_limits["max"])]
    targets = eligible[target].to_numpy(dtype=float, na_value=np.nan)
    if not (np.isfinite(targets) & (targets > 0)).all():
        raise ValueError("Delivery times must be finite, positive minutes.")
    split = split_chronologically(eligible)
    if len(split.validation) < 2 or len(split.test) < 2:
        raise ValueError("At least two orders are needed in each evaluation partition.")

    train_x, train_y = split.train[features], split.train[target]
    val_x, val_y = split.validation[features], split.validation[target]
    comparison: dict[str, dict[str, float]] = {}
    tuning: dict[str, list[dict[str, Any]]] = {}
    tuned_on_training: dict[str, Pipeline] = {}
    for candidate in CANDIDATES:
        trials = []
        best_mae = np.inf
        for parameters in ParameterGrid(candidate.grid):
            pipeline = _build(candidate, features, parameters).fit(train_x, train_y)
            scores = evaluate_predictions(val_y, pipeline.predict(val_x))
            trials.append({"parameters": parameters, **scores})
            if scores["mae"] < best_mae:
                best_mae = scores["mae"]
                tuned_on_training[candidate.name] = pipeline
        trials.sort(key=lambda trial: trial["mae"])
        comparison[candidate.name] = {key: trials[0][key] for key in ("mae", "rmse", "r2")}
        if candidate.name != BASELINE_NAME:
            tuning[candidate.name] = trials

    selected_name = min(tuning, key=lambda name: comparison[name]["mae"])
    importance = {
        name: _feature_importance(tuned_on_training[name], val_x, val_y, features) for name in tuning
    }

    final_training = pd.concat([split.train, split.validation])
    test_x = split.test[features]
    actual = split.test[target].to_numpy(dtype=float)
    pipelines: dict[str, Pipeline] = {}
    models: dict[str, dict[str, Any]] = {}
    predictions = pd.DataFrame({
        "order_timestamp": split.test[TIMESTAMP_COLUMN].dt.strftime("%Y-%m-%dT%H:%M:%S").to_numpy(),
        "road_distance_km": split.test["road_distance_km"].to_numpy(dtype=float, na_value=np.nan),
        "order_hour": split.test["order_hour"].to_numpy(dtype=float, na_value=np.nan)
        if "order_hour" in split.test
        else np.nan,
        "actual_minutes": actual,
    })
    for candidate in CANDIDATES:
        model_id = MODEL_IDS[candidate.name]
        parameters = (tuning.get(candidate.name) or [{"parameters": {"strategy": "median"}}])[0]["parameters"]
        pipeline = _build(candidate, features, parameters)
        pipeline.fit(final_training[features], final_training[target])
        predicted = pipeline.predict(test_x)
        errors = predicted - actual
        pipelines[model_id] = pipeline
        predictions[f"predicted_{model_id}"] = predicted
        models[model_id] = {
            "name": candidate.name,
            "selected": candidate.name == selected_name,
            "parameters": parameters,
            "artifact": f"models/{model_id}.joblib",
            "validation": comparison[candidate.name],
            "test": {
                **evaluate_predictions(actual, predicted),
                "mean_signed_error_minutes": float(errors.mean()),
            },
            **(
                {"validation_feature_importance_mae_increase": importance[candidate.name]}
                if candidate.name in importance
                else {}
            ),
        }

    selected_id = MODEL_IDS[selected_name]
    selected_predicted = predictions[f"predicted_{selected_id}"].to_numpy()
    predictions["predicted_minutes"] = selected_predicted
    predictions["error_minutes"] = selected_predicted - actual
    report = {
        "model_name": selected_name,
        "selected_model_id": selected_id,
        "features": features,
        "target": target,
        "rows_in_source": len(records),
        "rows_missing_road_distance": int(distances.isna().sum()),
        "rows_outside_road_distance_limits": int(distances.notna().sum() - len(eligible)),
        "rows_without_usable_timestamp": split.missing_timestamps + split.invalid_timestamps,
        "split": json.loads(split.summary().to_json(orient="index", date_format="iso")),
        "training_road_distance_km": {
            "min": float(final_training["road_distance_km"].min()),
            "max": float(final_training["road_distance_km"].max()),
        },
        "validation": comparison,
        "tuning": tuning,
        "selected_parameters": models[selected_id]["parameters"],
        "selected_model_beats_median_on_validation": (
            comparison[selected_name]["mae"] < comparison[BASELINE_NAME]["mae"]
        ),
        "validation_feature_importance_mae_increase": importance[selected_name],
        "test": models[selected_id]["test"],
        "models": models,
    }
    return TrainingResult(pipelines[selected_id], pipelines, report, predictions)


def _feature_importance(
    pipeline: Pipeline, val_x: pd.DataFrame, val_y: pd.Series, features: list[str]
) -> dict[str, float]:
    """Average increase in validation MAE when one feature's values are shuffled."""
    result = permutation_importance(
        pipeline, val_x, val_y, scoring="neg_mean_absolute_error", n_repeats=5, random_state=SEED
    )
    return {feature: float(value) for feature, value in zip(features, result.importances_mean)}


def _save_evaluation_chart(predictions: pd.DataFrame, path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    from matplotlib import pyplot as plt

    fig, (actual_plot, error_plot) = plt.subplots(1, 2, figsize=(10, 4), layout="constrained")
    actual = predictions["actual_minutes"]
    predicted = predictions["predicted_minutes"]
    limits = [min(actual.min(), predicted.min()), max(actual.max(), predicted.max())]
    actual_plot.scatter(actual, predicted, s=8, alpha=0.2, color="#136b76")
    actual_plot.plot(limits, limits, "--", color="#475569", linewidth=1)
    actual_plot.set(xlabel="Actual minutes", ylabel="Predicted minutes", title="Actual vs. predicted")
    error_plot.hist(predictions["error_minutes"], bins=30, color="#136b76")
    error_plot.axvline(0, color="#475569", linestyle="--", linewidth=1)
    error_plot.set(xlabel="Predicted minus actual minutes", ylabel="Orders", title="Prediction errors")
    fig.savefig(path, dpi=160)
    plt.close(fig)


def run_model_training(config_path: Path = DEFAULT_DATASET_CONFIG_PATH) -> dict:
    """Export every refitted candidate, the selected pipeline, and the training evidence."""
    config = load_dataset_config(config_path)
    paths = resolve_dataset_paths(config_path)
    data_path = paths.routed_parquet
    if not data_path.is_file():
        raise FileNotFoundError(f"Missing '{data_path}'. Run 'python -m ml.scripts.enrich_routes' first.")

    serving = config["serving"]
    result = fit_models(
        pd.read_parquet(data_path), serving["model_features"], config["schema"]["target_column"],
        serving["blocked_road_distance_km"],
    )
    report = result.report
    with data_path.open("rb") as source:
        report["dataset_sha256"] = hashlib.file_digest(source, "sha256").hexdigest()

    name = report["model_name"]
    metrics = {
        "model_name": name,
        **{f"validation_{key}": value for key, value in report["validation"][name].items()},
        **{f"test_{key}": report["test"][key] for key in ("mae", "rmse", "r2")},
    }
    paths.models_dir.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=paths.artifacts_dir) as temp:
        staged = Path(temp)
        outputs = {
            staged / "metrics.json": paths.metrics_artifact,
            staged / "manifest.json": paths.model_manifest,
            staged / "evaluation.png": paths.artifacts_dir / "evaluation.png",
            staged / "test_predictions.csv": paths.artifacts_dir / "test_predictions.csv",
            staged / "model.joblib": paths.model_artifact,
        }
        (staged / "metrics.json").write_text(json.dumps(metrics, indent=2, allow_nan=False), encoding="utf-8")
        (staged / "manifest.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
        result.test_predictions.to_csv(staged / "test_predictions.csv", index=False)
        _save_evaluation_chart(result.test_predictions, staged / "evaluation.png")
        joblib.dump(result.selected, staged / "model.joblib", compress=3)
        for model_id, pipeline in result.pipelines.items():
            file = staged / f"{model_id}.joblib"
            joblib.dump(pipeline, file, compress=3)
            outputs[file] = paths.models_dir / file.name
        for source, destination in outputs.items():
            os.replace(source, destination)
    return report
