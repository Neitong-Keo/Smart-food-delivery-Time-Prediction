"""Tests for the prediction contract and its alignment with the ML workflow."""

import json
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path

import joblib
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sklearn.compose import make_column_transformer
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder

from app.core.config import Settings
from app.main import create_app
from app.schemas.prediction import PredictionRequest
from app.services.prediction import (
    assess_delivery,
    build_delivery_features,
    create_predictor,
    load_serving_limits,
)
from app.services.prediction.demo import DEMO_BASE_MINUTES, DEMO_MINUTES_PER_ROAD_KM
from app.services.prediction.features import SUPPORTED_MODEL_COLUMNS
from ml import DEFAULT_DATASET_CONFIG_PATH
from ml.manifest import load_dataset_config, resolve_dataset_paths
from ml.train import split_chronologically


client = TestClient(create_app())
LIMITS = load_serving_limits()

PAYLOAD = {
    "restaurant_id": "restaurant_001",
    "restaurant_latitude": 12.972532,
    "restaurant_longitude": 77.608179,
    "delivery_latitude": 12.992532,
    "delivery_longitude": 77.628179,
    "road_distance_km": 3.5,
    "route_duration_minutes": 12,
    "order_type": "snack",
    "is_festival": True,
    "order_placed_at": "2026-11-20T19:30:00+05:30",
}


def restaurant():
    return client.app.state.restaurants.get_restaurant("restaurant_001")


def features_for(**changes):
    return build_delivery_features(PredictionRequest(**{**PAYLOAD, **changes}), restaurant())


def save_pipeline(path: Path, columns: list[str] | None = None, scale: float = 1.0) -> Path:
    """Fit a throwaway pipeline on the same nullable dtypes as the training Parquet."""
    selected = columns or list(LIMITS.model_features)
    rows = {
        "Type_of_order": ["meal", "snack", "drinks", "buffet"],
        "Festival": ["no", "yes", "no", "no"],
        "City": ["Metropolitan", "Urban", "Semi-Urban", "Metropolitan"],
        "order_hour": [9, 12, 18, 22],
        "order_day_of_week": [0, 2, 4, 6],
        "road_distance_km": [3.0, 8.0, 17.0, 28.0],
        "route_duration_minutes": [6.0, 14.0, 25.0, 40.0],
    }
    dtypes = {
        "Type_of_order": "string", "Festival": "string", "City": "string",
        "order_hour": "Int64", "order_day_of_week": "Int64",
        "road_distance_km": "Float64", "route_duration_minutes": "Float64",
    }
    frame = pd.DataFrame(rows)[selected].astype({column: dtypes[column] for column in selected})
    pipeline = make_pipeline(
        make_column_transformer(
            (OneHotEncoder(handle_unknown="ignore"), ["Type_of_order", "Festival", "City"]),
            remainder="passthrough",
        ),
        LinearRegression(),
    )
    pipeline.fit(frame, [15.0 * scale, 24.0 * scale, 33.0 * scale, 48.0 * scale])
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, path)
    return path


def save_artifacts(directory: Path, manifest: dict | None = None) -> Path:
    """Write model.joblib, each candidate under models/, and a manifest like the trainer does."""
    scales = {"median": 0.5, "decision_tree": 1.5, "xgboost": 1.0}
    for model_id, scale in scales.items():
        save_pipeline(directory / "models" / f"{model_id}.joblib", scale=scale)
    model_path = save_pipeline(directory / "model.joblib", scale=scales["xgboost"])
    if manifest is None:
        manifest = {
            "model_name": "XGBoost",
            "selected_model_id": "xgboost",
            "models": {
                model_id: {
                    "name": name,
                    "selected": model_id == "xgboost",
                    "validation": {"mae": 7.0 - index, "rmse": 9.0 - index, "r2": 0.1 * index},
                    "test": {
                        "mae": 6.5 - index,
                        "rmse": 8.5 - index,
                        "r2": 0.1 * index,
                        "mean_signed_error_minutes": 0.1,
                    },
                }
                for index, (model_id, name) in enumerate(
                    [("median", "Median baseline"), ("decision_tree", "Decision Tree"), ("xgboost", "XGBoost")]
                )
            },
        }
    (directory / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return model_path


def model_client_for(model_path: Path) -> TestClient:
    return TestClient(create_app(Settings(prediction_mode="model", model_path=str(model_path))))


def test_predict_returns_labelled_demo_result() -> None:
    response = client.post("/api/predict", json=PAYLOAD)

    assert response.status_code == 200
    assert response.json()["predicted_delivery_time_minutes"] == round(
        DEMO_BASE_MINUTES + DEMO_MINUTES_PER_ROAD_KM * 3.5
    )
    assert response.json()["model_status"] == "demo"


def test_longer_road_route_increases_the_prediction() -> None:
    short = client.post("/api/predict", json={**PAYLOAD, "road_distance_km": 3.0}).json()
    long = client.post("/api/predict", json={**PAYLOAD, "road_distance_km": 24.0}).json()

    assert long["predicted_delivery_time_minutes"] > short["predicted_delivery_time_minutes"]


def test_road_distance_reaches_the_model_unchanged() -> None:
    assert features_for(road_distance_km=7.25).to_model_input()["road_distance_km"] == 7.25


def test_prediction_requires_an_actual_road_distance() -> None:
    payload = {key: value for key, value in PAYLOAD.items() if key != "road_distance_km"}

    assert client.post("/api/predict", json=payload).status_code == 422
    assert client.post("/api/predict", json={**PAYLOAD, "road_distance_km": None}).status_code == 422


@pytest.mark.parametrize(
    "change",
    [
        {"delivery_latitude": 91},
        {"delivery_longitude": -181},
        {"delivery_latitude": 0, "delivery_longitude": 0},
        {"road_distance_km": -1},
        {"order_type": "unknown"},
        {"order_placed_at": "2026-11-20T19:30:00"},
    ],
)
def test_predict_rejects_invalid_input(change: dict[str, object]) -> None:
    assert client.post("/api/predict", json={**PAYLOAD, **change}).status_code == 422


def test_predict_rejects_unknown_restaurant() -> None:
    response = client.post("/api/predict", json={**PAYLOAD, "restaurant_id": "missing"})

    assert response.status_code == 404


def test_predict_blocks_a_road_distance_beyond_the_limit() -> None:
    response = client.post(
        "/api/predict", json={**PAYLOAD, "road_distance_km": LIMITS.blocked_max_km + 1}
    )

    assert response.status_code == 422
    assert "too far" in response.json()["detail"]


def test_predict_blocks_a_pin_at_the_restaurant() -> None:
    response = client.post("/api/predict", json={**PAYLOAD, "road_distance_km": 0})

    assert response.status_code == 422
    assert "at the restaurant" in response.json()["detail"]


def test_predict_returns_range_warnings_with_the_result() -> None:
    payload = {**PAYLOAD, "road_distance_km": 1.0, "order_placed_at": "2026-11-20T03:00:00+07:00"}

    body = client.post("/api/predict", json=payload).json()

    assert {issue["code"] for issue in body["warnings"]} == {
        "distance_below_training_range",
        "order_time_outside_training_hours",
    }


def test_preview_returns_exact_model_input_without_predicting() -> None:
    body = client.post("/api/predict/preview", json=PAYLOAD).json()

    assert body["can_predict"] is True
    assert body["model_input"]["road_distance_km"] == 3.5
    assert "distance_km" not in body["model_input"]
    assert body["model_input"]["Type_of_order"] == "snack"


def test_preview_reports_blocked_orders() -> None:
    body = client.post(
        "/api/predict/preview", json={**PAYLOAD, "road_distance_km": LIMITS.blocked_max_km + 1}
    ).json()

    assert body["can_predict"] is False
    assert body["issues"][0]["code"] == "distance_too_far"


@pytest.mark.parametrize(
    ("distance", "severity", "code"),
    [
        (LIMITS.blocked_min_km - 0.01, "blocked", "distance_too_close"),
        (LIMITS.training_min_km - 0.01, "warning", "distance_below_training_range"),
        (LIMITS.training_min_km, None, None),
        (LIMITS.training_max_km, None, None),
        (LIMITS.training_max_km + 0.01, "warning", "distance_above_training_range"),
        (LIMITS.blocked_max_km, "warning", "distance_above_training_range"),
        (LIMITS.blocked_max_km + 0.01, "blocked", "distance_too_far"),
    ],
)
def test_distance_limits(distance: float, severity: str | None, code: str | None) -> None:
    issues = assess_delivery(replace(features_for(), road_distance_km=distance), LIMITS)

    assert [(issue.severity, issue.code) for issue in issues] == ([(severity, code)] if code else [])


@pytest.mark.parametrize(("hour", "warns"), [(0, False), (3, True), (7, True), (8, False), (23, False)])
def test_order_hour_limits(hour: int, warns: bool) -> None:
    issues = assess_delivery(replace(features_for(), order_hour=hour), LIMITS)

    assert any(issue.code == "order_time_outside_training_hours" for issue in issues) is warns


def test_missing_model_returns_503_instead_of_a_fake_prediction(tmp_path: Path) -> None:
    missing = str(tmp_path / "model.joblib")
    model_client = TestClient(create_app(Settings(prediction_mode="model", model_path=missing)))

    response = model_client.post("/api/predict", json=PAYLOAD)
    info = model_client.get("/api/model").json()

    assert response.status_code == 503
    assert "not found" in response.json()["detail"]
    assert info["model_status"] == "unavailable"
    assert "not found" in info["detail"]


def test_saved_pipeline_serves_live_predictions_from_road_distance(tmp_path: Path) -> None:
    path = save_pipeline(tmp_path / "model.joblib")
    model_client = TestClient(create_app(Settings(prediction_mode="model", model_path=str(path))))

    near = model_client.post("/api/predict", json={**PAYLOAD, "road_distance_km": 3.0})
    far = model_client.post("/api/predict", json={**PAYLOAD, "road_distance_km": 24.0})
    info = model_client.get("/api/model").json()

    assert near.status_code == far.status_code == 200
    assert near.json()["model_status"] == "live"
    assert far.json()["predicted_delivery_time_minutes"] > near.json()["predicted_delivery_time_minutes"]
    assert info["model_status"] == "live"
    assert info["feature_columns"] == list(LIMITS.model_features)


def test_model_can_also_use_route_drive_time(tmp_path: Path) -> None:
    columns = [*LIMITS.model_features, "route_duration_minutes"]
    predictor = create_predictor("model", str(save_pipeline(tmp_path / "model.joblib", columns)))

    model_input = features_for().to_model_input(predictor.feature_columns)

    assert predictor.status == "live"
    assert model_input["road_distance_km"] == 3.5
    assert model_input["route_duration_minutes"] == 12
    assert predictor.predict(features_for()) > 0


def test_model_trained_on_straight_line_distance_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "model.joblib"
    frame = pd.DataFrame({"distance_km": [1.0, 2.0]})
    joblib.dump(LinearRegression().fit(frame, [10.0, 20.0]), path)

    predictor = create_predictor("model", str(path))

    assert predictor.status == "unavailable"
    assert "road_distance_km" in predictor.detail


def test_model_with_unsupported_columns_is_reported(tmp_path: Path) -> None:
    path = tmp_path / "model.joblib"
    frame = pd.DataFrame({"Weather_conditions": [1.0, 2.0]})
    joblib.dump(LinearRegression().fit(frame, [10.0, 20.0]), path)

    predictor = create_predictor("model", str(path))

    assert predictor.status == "unavailable"
    assert "Weather_conditions" in predictor.detail


def test_corrupt_model_file_is_reported(tmp_path: Path) -> None:
    path = tmp_path / "model.joblib"
    path.write_bytes(b"not a model")

    predictor = create_predictor("model", str(path))

    assert predictor.status == "unavailable"
    assert "could not be loaded" in predictor.detail


def test_demo_mode_lists_a_single_demo_model() -> None:
    body = client.get("/api/models").json()

    assert body["selected_model_id"] == "demo"
    assert [(model["id"], model["selected"], model["status"]) for model in body["models"]] == [
        ("demo", True, "demo")
    ]
    assert client.post("/api/predict", json=PAYLOAD).json()["model_id"] == "demo"


def test_model_list_reports_each_saved_model_and_its_scores(tmp_path: Path) -> None:
    model_client = model_client_for(save_artifacts(tmp_path))

    body = model_client.get("/api/models").json()

    assert body["selected_model_id"] == "xgboost"
    assert [model["id"] for model in body["models"]] == ["median", "decision_tree", "xgboost"]
    assert [model["selected"] for model in body["models"]] == [False, False, True]
    assert {model["status"] for model in body["models"]} == {"live"}
    assert body["models"][0]["name"] == "Median baseline"
    assert body["models"][2]["test"]["mae"] == 4.5
    assert body["models"][2]["test"]["mean_signed_error_minutes"] == 0.1
    assert body["models"][1]["validation"]["rmse"] == 8.0


def test_predict_uses_the_requested_model(tmp_path: Path) -> None:
    model_client = model_client_for(save_artifacts(tmp_path))

    default = model_client.post("/api/predict", json=PAYLOAD).json()
    chosen = {
        model_id: model_client.post("/api/predict", json={**PAYLOAD, "model_id": model_id}).json()
        for model_id in ("median", "decision_tree", "xgboost")
    }

    assert default["model_id"] == "xgboost"
    assert default["model_name"] == "XGBoost"
    assert default["model_status"] == "live"
    assert chosen["xgboost"]["predicted_delivery_time_minutes"] == default["predicted_delivery_time_minutes"]
    minutes = [chosen[key]["predicted_delivery_time_minutes"] for key in ("median", "xgboost", "decision_tree")]
    assert minutes == sorted(minutes) and len(set(minutes)) == 3
    assert chosen["median"]["model_name"] == "Median baseline"


@pytest.mark.parametrize("model_id", ["missing", "Bad-ID"])
def test_predict_rejects_an_unknown_model(model_id: str) -> None:
    response = client.post("/api/predict", json={**PAYLOAD, "model_id": model_id})

    assert response.status_code == 422


def test_compare_returns_every_model_for_one_order(tmp_path: Path) -> None:
    model_client = model_client_for(save_artifacts(tmp_path))

    response = model_client.post(
        "/api/predict/compare", json={**PAYLOAD, "order_placed_at": "2026-11-20T03:00:00+05:30"}
    )
    body = response.json()

    assert response.status_code == 200
    assert body["model_status"] == "live"
    assert body["selected_model_id"] == "xgboost"
    assert [prediction["model_id"] for prediction in body["predictions"]] == ["median", "decision_tree", "xgboost"]
    assert all(prediction["predicted_delivery_time_minutes"] >= 1 for prediction in body["predictions"])
    assert [prediction["test_mae"] for prediction in body["predictions"]] == [6.5, 5.5, 4.5]
    assert {issue["code"] for issue in body["warnings"]} == {"order_time_outside_training_hours"}
    single = model_client.post(
        "/api/predict", json={**PAYLOAD, "order_placed_at": "2026-11-20T03:00:00+05:30"}
    ).json()
    assert body["predictions"][2]["predicted_delivery_time_minutes"] == single["predicted_delivery_time_minutes"]


def test_compare_blocks_orders_outside_the_limits() -> None:
    response = client.post(
        "/api/predict/compare", json={**PAYLOAD, "road_distance_km": LIMITS.blocked_max_km + 1}
    )

    assert response.status_code == 422
    assert "too far" in response.json()["detail"]


def test_compare_reports_a_model_that_cannot_load(tmp_path: Path) -> None:
    model_path = save_artifacts(tmp_path)
    (tmp_path / "models" / "decision_tree.joblib").write_bytes(b"not a model")
    model_client = model_client_for(model_path)

    models = model_client.get("/api/models").json()["models"]
    body = model_client.post("/api/predict/compare", json=PAYLOAD).json()

    assert models[1]["status"] == "unavailable"
    assert "could not be loaded" in models[1]["detail"]
    assert body["predictions"][1]["predicted_delivery_time_minutes"] is None
    assert "could not be loaded" in body["predictions"][1]["detail"]
    assert body["predictions"][2]["predicted_delivery_time_minutes"] >= 1


def test_compare_fails_when_no_model_can_predict(tmp_path: Path) -> None:
    model_client = model_client_for(tmp_path / "model.joblib")

    response = model_client.post("/api/predict/compare", json=PAYLOAD)

    assert response.status_code == 503
    assert "not found" in response.json()["detail"]


def test_a_deployment_with_only_model_joblib_serves_one_model(tmp_path: Path) -> None:
    """Older artifacts have no models/ folder and record only the winner's test scores."""
    model_path = save_pipeline(tmp_path / "model.joblib")
    manifest = {
        "model_name": "XGBoost",
        "validation": {"XGBoost": {"mae": 6.16, "rmse": 7.71, "r2": 0.36}},
        "test": {"mae": 6.04, "rmse": 7.56, "r2": 0.32, "mean_signed_error_minutes": 0.15},
    }
    (tmp_path / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    model_client = model_client_for(model_path)

    body = model_client.get("/api/models").json()

    assert [(model["id"], model["selected"]) for model in body["models"]] == [("xgboost", True)]
    assert body["models"][0]["validation"]["mae"] == 6.16
    assert body["models"][0]["test"]["mae"] == 6.04
    assert model_client.post("/api/predict", json=PAYLOAD).json()["model_id"] == "xgboost"


def test_unknown_prediction_mode_fails_at_startup() -> None:
    with pytest.raises(ValueError, match="PREDICTION_MODE"):
        create_predictor("typo")


def test_model_info_reports_demo_mode_and_limits() -> None:
    body = client.get("/api/model").json()

    assert body["model_status"] == "demo"
    assert body["limits"]["training_road_distance_min_km"] == LIMITS.training_min_km
    assert body["limits"]["blocked_road_distance_max_km"] == LIMITS.blocked_max_km


def test_model_input_matches_the_configured_features() -> None:
    schema = load_dataset_config(DEFAULT_DATASET_CONFIG_PATH)["schema"]

    model_input = features_for().to_model_input()

    assert list(model_input) == list(LIMITS.model_features)
    assert set(LIMITS.model_features) <= SUPPORTED_MODEL_COLUMNS
    # Road distance replaces the straight-line column. Every other feature is order-time data.
    assert set(LIMITS.model_features) - {"road_distance_km"} == set(schema["feature_allowlist"]) - {"distance_km"}
    assert model_input["Type_of_order"] == "snack"
    assert model_input["Festival"] == "yes"
    assert model_input["City"] == "Metropolitan"
    # 20 November 2026 is a Friday. The dataset uses Monday=0.
    assert model_input["order_hour"] == 19
    assert model_input["order_day_of_week"] == 4


def test_order_clock_uses_the_restaurant_time_zone() -> None:
    placed_at = datetime(2026, 11, 21, 1, 15, tzinfo=timezone(timedelta(hours=7)))

    features = features_for(order_placed_at=placed_at.isoformat())
    assert features.order_hour == 23
    assert features.order_day_of_week == 4


def test_order_hours_match_the_cleaned_dataset() -> None:
    """Runs once the real dataset has been cleaned locally."""
    path = resolve_dataset_paths().processed_parquet
    if not path.is_file():
        pytest.skip("Cleaned dataset not present.")

    hours = pd.read_parquet(path, columns=["order_hour"])["order_hour"].dropna().astype(int)

    assert set(hours) <= LIMITS.supported_order_hours


def test_road_distance_limits_match_the_enriched_dataset() -> None:
    """Verify the published limits against the orders used to fit the final model."""
    config = load_dataset_config(DEFAULT_DATASET_CONFIG_PATH)
    path = resolve_dataset_paths().base_dir / config["paths"]["routed_parquet"]
    if not path.is_file():
        pytest.skip("Route-enriched dataset not present.")

    records = pd.read_parquet(path, columns=["road_distance_km", "order_timestamp"])
    in_range = records["road_distance_km"].between(LIMITS.blocked_min_km, LIMITS.blocked_max_km)
    split = split_chronologically(records.loc[in_range])
    distances = pd.concat([split.train["road_distance_km"], split.validation["road_distance_km"]])

    assert distances.min() == pytest.approx(LIMITS.training_min_km, abs=0.01)
    assert distances.max() == pytest.approx(LIMITS.training_max_km, abs=0.01)
