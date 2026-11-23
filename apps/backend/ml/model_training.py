"""Train, compare, and export road-distance ETA regression models."""

import hashlib
import json
import os
from functools import partial
from pathlib import Path
from tempfile import TemporaryDirectory

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
from ml.train import split_chronologically

SEED = 42


def fit_models(
    records: pd.DataFrame, features: list[str], target: str, distance_limits: dict[str, float]
) -> tuple[Pipeline, dict, pd.DataFrame]:
    """Select by validation MAE and evaluate the refitted winner on newer orders."""
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
    baseline = DummyRegressor(strategy="median").fit(train_x, train_y)
    comparison = {"Median baseline": evaluate_predictions(val_y, baseline.predict(val_x))}
    tuning = {}
    candidates = [
        (
            "Decision Tree",
            DecisionTreeRegressor,
            {"max_depth": [3, 5, 8], "min_samples_leaf": [20, 80]},
        ),
        (
            "XGBoost",
            partial(XGBRegressor, n_jobs=2),
            {"max_depth": [3, 5], "learning_rate": [0.03, 0.1], "n_estimators": [150, 300]},
        ),
    ]
    for name, estimator, grid in candidates:
        trials = []
        for parameters in ParameterGrid(grid):
            pipeline = build_training_pipeline(features, estimator(random_state=SEED, **parameters))
            pipeline.fit(train_x, train_y)
            scores = evaluate_predictions(val_y, pipeline.predict(val_x))
            trials.append({"parameters": parameters, **scores})
        tuning[name] = sorted(trials, key=lambda trial: trial["mae"])
        comparison[name] = {key: tuning[name][0][key] for key in ("mae", "rmse", "r2")}

    name, estimator, _ = min(candidates, key=lambda candidate: comparison[candidate[0]]["mae"])
    parameters = tuning[name][0]["parameters"]
    pipeline = build_training_pipeline(features, estimator(random_state=SEED, **parameters))
    pipeline.fit(train_x, train_y)
    importance = permutation_importance(
        pipeline, val_x, val_y, scoring="neg_mean_absolute_error", n_repeats=5, random_state=SEED
    )

    final_training = pd.concat([split.train, split.validation])
    pipeline.fit(final_training[features], final_training[target])
    actual = split.test[target].to_numpy(dtype=float)
    predicted = pipeline.predict(split.test[features])
    errors = predicted - actual
    report = {
        "model_name": name,
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
        "selected_parameters": parameters,
        "selected_model_beats_median_on_validation": (
            comparison[name]["mae"] < comparison["Median baseline"]["mae"]
        ),
        "validation_feature_importance_mae_increase": {
            feature: float(value) for feature, value in zip(features, importance.importances_mean)
        },
        "test": {**evaluate_predictions(actual, predicted), "mean_signed_error_minutes": float(errors.mean())},
    }
    test_predictions = pd.DataFrame({
        "actual_minutes": actual,
        "predicted_minutes": predicted,
        "error_minutes": errors,
    })
    return pipeline, report, test_predictions


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
    """Export the selected pipeline and its training and test evidence."""
    config = load_dataset_config(config_path)
    paths = resolve_dataset_paths(config_path)
    data_path = paths.base_dir / config["paths"]["routed_parquet"]
    if not data_path.is_file():
        raise FileNotFoundError(f"Missing '{data_path}'. Run 'python -m ml.scripts.enrich_routes' first.")

    serving = config["serving"]
    model, report, predictions = fit_models(
        pd.read_parquet(data_path), serving["model_features"], config["schema"]["target_column"],
        serving["blocked_road_distance_km"],
    )
    with data_path.open("rb") as source:
        report["dataset_sha256"] = hashlib.file_digest(source, "sha256").hexdigest()

    name = report["model_name"]
    metrics = {
        "model_name": name,
        **{f"validation_{key}": value for key, value in report["validation"][name].items()},
        **{f"test_{key}": report["test"][key] for key in ("mae", "rmse", "r2")},
    }
    paths.artifacts_dir.mkdir(parents=True, exist_ok=True)
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
        predictions.to_csv(staged / "test_predictions.csv", index=False)
        _save_evaluation_chart(predictions, staged / "evaluation.png")
        joblib.dump(model, staged / "model.joblib", compress=3)
        for source, destination in outputs.items():
            os.replace(source, destination)
    return report
