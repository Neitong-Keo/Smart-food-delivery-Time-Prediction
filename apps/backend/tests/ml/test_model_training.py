"""Check that training with nullable Parquet columns produces a serving-compatible model."""

import joblib
import numpy as np
import pandas as pd

from app.services.prediction.features import DeliveryFeatures
from app.services.prediction.model import MODEL_INPUT_DTYPES, TrainedModelPredictor
from ml.manifest import load_dataset_config
from ml.model_training import fit_models


def test_winning_pipeline_can_score_an_app_order(tmp_path) -> None:
    config = load_dataset_config()
    serving = config["serving"]
    features = serving["model_features"]
    target = config["schema"]["target_column"]
    distances = np.tile([2.0, 5.0, 9.0, 13.0], 60)
    records = pd.DataFrame({
        "Type_of_order": "meal",
        "Festival": "no",
        "City": ["Urban", pd.NA, "Urban", "Metropolitan"] * 60,
        "order_hour": 19,
        "order_day_of_week": 3,
        "road_distance_km": distances,
        "order_timestamp": pd.date_range("2022-03-01", periods=len(distances), freq="h"),
        target: 10.0 + 2.0 * distances,
    }).astype({feature: MODEL_INPUT_DTYPES[feature] for feature in features})
    records.loc[0, "road_distance_km"] = pd.NA
    records.loc[1, "road_distance_km"] = 50.0

    model, report, test_predictions = fit_models(records, features, target, serving["blocked_road_distance_km"])

    assert set(report["validation"]) == {"Median baseline", "Decision Tree", "XGBoost"}
    assert report["rows_missing_road_distance"] == 1
    assert report["rows_outside_road_distance_limits"] == 1
    assert report["split"]["Test"]["Rows"] == len(test_predictions)
    assert report["test"]["mae"] < report["validation"]["Median baseline"]["mae"]
    path = tmp_path / "model.joblib"
    joblib.dump(model, path)
    predictor = TrainedModelPredictor(path)

    assert predictor.status == "live"
    order = DeliveryFeatures("buffet", True, "Semi-Urban", 19, 3, 5.0, None)
    assert 10 <= predictor.predict(order) <= 40
