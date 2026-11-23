# Connecting the trained model

The app returns **demo predictions** until a trained model is connected. The API already loads and serves a fitted scikit-learn pipeline, and the frontend needs no changes.

## How a prediction flows

```text
Map route (OSRM) -> Next.js -> POST /api/predict -> build_delivery_features() -> Predictor.predict()
                                                                                  |- DemoPredictor
                                                                                  '- TrainedModelPredictor
```

| File | Responsibility |
| --- | --- |
| [`app/schemas/prediction.py`](../apps/backend/app/schemas/prediction.py) | API request and response contract |
| [`app/services/prediction/features.py`](../apps/backend/app/services/prediction/features.py) | Maps a request onto the model's columns |
| [`app/services/prediction/assessment.py`](../apps/backend/app/services/prediction/assessment.py) | Warns about or blocks out-of-range orders |
| [`app/services/prediction/model.py`](../apps/backend/app/services/prediction/model.py) | Loads and runs the saved pipeline |
| [`ml/routes.py`](../apps/backend/ml/routes.py) | Adds actual road distances to the training data |
| [`ml/configs/dataset.yaml`](../apps/backend/ml/configs/dataset.yaml) | Model columns and input limits, under `serving` |

## Model inputs

The model must train on the same measure it receives in the app. The Kaggle dataset has coordinates but no road distance, so `ml.scripts.enrich_routes` requests the actual route for each order.

| Model column | Kaggle source | In the app | Values |
| --- | --- | --- | --- |
| `Type_of_order` | `Type_of_order` | Order type control | `snack`, `meal`, `drinks`, `buffet` |
| `Festival` | `Festival` | Festival checkbox | `yes`, `no` |
| `City` | `City` | `city_type` on the restaurant | `Metropolitan`, `Urban`, `Semi-Urban` |
| `order_hour` | `Time_Orderd` | Local order time | 0 to 23 |
| `order_day_of_week` | `Order_Date` | Local order date | Monday = 0, Sunday = 6 |
| `road_distance_km` | OSRM route between the restaurant and delivery coordinates | OSRM route between the restaurant and the customer's pin | Kilometers along the road |

Training and the app choose routes the same way: OSRM's driving profile, preferring a route without a ferry, and rejecting points more than 500 m from a road.

`route_duration_minutes` is also added to the training file. If a pipeline is trained with that column, the API supplies it automatically.

These Kaggle columns are deliberately not model inputs:

- **Weather and traffic** are described on Kaggle as measured during delivery, so they aren't known when the customer orders.
- **Rider age, rating, vehicle, vehicle condition, and multiple deliveries** depend on rider assignment, which the app doesn't have.
- **Pickup time** happens after the order is placed.

## Train and connect the model

### 1. Prepare the data

Follow [Prepare the training data](../README.md#prepare-the-training-data). This creates `ml/data/processed/dataset_with_routes.parquet`.

### 2. Train and save a pipeline

Include preprocessing in the pipeline. `City` and `road_distance_km` can be missing in the training data, so either impute them or drop those rows. Run this from `apps/backend`, replacing `build_your_pipeline()` with your own model:

```python
import joblib
import pandas as pd

from ml.manifest import load_dataset_config, resolve_dataset_paths
from ml.train import split_chronologically

config = load_dataset_config()
paths = resolve_dataset_paths()
features = config["serving"]["model_features"]
target = config["schema"]["target_column"]

records = pd.read_parquet(paths.base_dir / config["paths"]["routed_parquet"])
records = records.dropna(subset=["road_distance_km"])
split = split_chronologically(records)

pipeline = build_your_pipeline()
pipeline.fit(split.train[features], split.train[target])

paths.model_artifact.parent.mkdir(parents=True, exist_ok=True)
joblib.dump(pipeline, paths.model_artifact)
```

Compare candidates on `split.validation` against the median baseline's error of 7.75 minutes. Use `split.test` once, for the final model.

To show results on the **Model** page, save a flat JSON object to `ml/artifacts/v1/metrics.json`:

```json
{ "model_name": "Random Forest", "validation_mae": 4.2, "validation_rmse": 5.6, "test_mae": 4.3 }
```

These numbers are only an example of the format.

### 3. Start the API in model mode

```powershell
Set-Location apps/backend
$env:PREDICTION_MODE = "model"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8600
```

### 4. Confirm it is live

Open [http://localhost:8600/api/model](http://localhost:8600/api/model). `model_status` should be `live`. If it is `unavailable`, `detail` explains why. Then run `python -m pytest` from `apps/backend` to confirm the configured limits match the data.

Only load `model.joblib` files from a source you trust, because loading one can run code.

## API contract

**Request:** `POST /api/predict` or `POST /api/predict/preview`

```json
{
  "restaurant_id": "restaurant_001",
  "restaurant_latitude": 11.5615,
  "restaurant_longitude": 104.9285,
  "delivery_latitude": 11.5696,
  "delivery_longitude": 104.9211,
  "road_distance_km": 1.61,
  "route_duration_minutes": 2.8,
  "order_type": "meal",
  "is_festival": false,
  "order_placed_at": "2026-11-23T19:00:00+07:00"
}
```

`road_distance_km` is required.

**Response:** `POST /api/predict`

```json
{
  "predicted_delivery_time_minutes": 16,
  "model_status": "demo",
  "warnings": []
}
```

`model_status` is `demo` or `live`. The interface labels every `demo` result. An order outside the blocked limits returns HTTP 422 with a message for the customer.

## Input limits

Limits live under `serving` in [`dataset.yaml`](../apps/backend/ml/configs/dataset.yaml).

| Setting | Current value | Effect |
| --- | --- | --- |
| `training_road_distance_km` | 1.49 to 31.79 km | Warns outside this range |
| `blocked_road_distance_km` | 0.1 to 40 km | Declines to predict outside this range |
| `supported_order_hours` | 8 AM to midnight | Warns at other hours |
| `max_point_to_road_m` | 500 m | Treats a farther point as having no road route |

**The road distance range is provisional.** It comes from the 42 Kaggle preview rows that had a usable road route. `ml.scripts.enrich_routes` prints the full range, and a test fails until `dataset.yaml` matches it. The order hours are checked the same way once the cleaned Parquet exists.

## Run a local OSRM server

A local server is faster than the public one and avoids putting bulk load on a shared service. The dataset covers India, so download the [India extract from Geofabrik](https://download.geofabrik.de/asia/india-latest.osm.pbf) into an empty folder. Processing it needs several gigabytes of disk and memory. From that folder:

```powershell
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/india-latest.osm.pbf
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-partition /data/india-latest.osrm
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-customize /data/india-latest.osrm
docker run -t -i -p 5000:5000 -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld /data/india-latest.osrm
```

## Before presenting model results

- **Some rows have no usable road route.** In the Kaggle preview, 5 of 47 valid rows were more than 500 m from a road. Report how many rows the enrichment step kept.
- **Kaggle's delivery points look generated.** In every valid preview row, the delivery point is the restaurant plus the same offset to latitude and longitude. Their road distances are real, but the trips aren't real customer journeys.
- **The training data and sample restaurants are in different places.** The dataset covers Indian cities, while the sample catalog is in Phnom Penh. Treat Phnom Penh predictions as unvalidated.

## Changing the features

1. Add the column to `serving.model_features` and `SUPPORTED_MODEL_COLUMNS`.
2. Add it to `PredictionRequest`, `DeliveryFeatures`, and `to_model_input()`.
3. Add its pandas type to `MODEL_INPUT_DTYPES` in `model.py`.
4. Add it to [`types/prediction.ts`](../apps/web/src/types/prediction.ts) and [`prediction-request.ts`](../apps/web/src/lib/prediction-request.ts).
