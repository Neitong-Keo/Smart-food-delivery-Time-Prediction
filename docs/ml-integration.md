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
| `order_hour` | `Time_Orderd` | Order time in the restaurant's time zone | 0 to 23 |
| `order_day_of_week` | `Order_Date` | Order date in the restaurant's time zone | Monday = 0, Sunday = 6 |
| `road_distance_km` | OSRM route between the restaurant and delivery coordinates | OSRM route between the restaurant and the customer's pin | Kilometers along the road |

Training and the app use OSRM's driving profile and reject points more than 500 m from a road. The route-by-route enrichment and the app prefer an alternative without a ferry when available. The optional `--table` enrichment batches nearby trips and uses fastest-route distances without step details.

`route_duration_minutes` is also added to the training file. If a pipeline is trained with that column, the API supplies it automatically.

These Kaggle columns are deliberately not model inputs:

- **Weather and traffic** are described on Kaggle as measured during delivery, so they aren't known when the customer orders.
- **Rider age, rating, vehicle, vehicle condition, and multiple deliveries** depend on rider assignment, which the app doesn't have.
- **Pickup time** happens after the order is placed.

## Train and connect the model

### 1. Prepare the data

Follow [Prepare the training data](../README.md#prepare-the-training-data). This creates `ml/data/processed/dataset_with_routes.parquet`.

### 2. Train and save a pipeline

Run this from `apps/backend`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-training.txt
.\.venv\Scripts\python.exe -m ml.scripts.train_models
```

The trainer uses orders with usable road distances inside the app's supported delivery range. It compares Decision Tree and XGBoost with a median predictor on the same chronological split, selects by validation MAE, and refits the selected settings on training and validation orders before scoring the newest test orders. The saved pipeline includes category encoding and missing-value handling.

The **Model** page reads the summary in `ml/artifacts/v1/metrics.json`. The manifest contains the full validation comparison, tuning results, split dates and sizes, feature importance, and test errors. The evaluation plot and test predictions are in the same directory.

#### Evaluation on the Zomato dataset

The run used OSRM Table distances for the Kaggle coordinates. Of 45,584 cleaned orders, 37,700 had a usable road route. The 40 km app limit excluded 86 more and invalid or missing timestamps excluded another 1,198. The chronological split had 25,489 training orders, 5,464 validation orders, and 5,463 test orders.

| Validation model | MAE (min) | RMSE (min) | R² |
| --- | ---: | ---: | ---: |
| Median baseline | 7.77 | 9.71 | -0.021 |
| Decision Tree | 6.25 | 7.84 | 0.335 |
| XGBoost | 6.16 | 7.71 | 0.356 |

XGBoost won with 300 trees, depth 5, and a learning rate of 0.03. After refitting, its test MAE was **6.04 minutes**, RMSE was **7.56 minutes**, and R² was **0.316**. Shuffling order hour on validation increased MAE the most, by 1.07 minutes. On test orders that took more than 35 minutes, the model underestimated by 9.89 minutes on average.

These results measure performance on the held-out Zomato orders from multiple Indian cities. See [Before presenting model results](#before-presenting-model-results) for the dataset's location limitations.

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
  "restaurant_latitude": 12.972532,
  "restaurant_longitude": 77.608179,
  "delivery_latitude": 12.992532,
  "delivery_longitude": 77.628179,
  "road_distance_km": 4.6892,
  "route_duration_minutes": 7.47,
  "order_type": "meal",
  "is_festival": false,
  "order_placed_at": "2026-11-23T19:00:00+05:30"
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
| `training_road_distance_km` | 1.49 to 39.51 km | Warns outside this range |
| `blocked_road_distance_km` | 0.1 to 40 km | Declines to predict outside this range |
| `supported_order_hours` | 8 AM to midnight | Warns at other hours |
| `max_point_to_road_m` | 500 m | Treats a farther point as having no road route |

The road distance range is from the orders used to fit the final pipeline. If you retrain with a new dataset, copy `training_road_distance_km` from the new training manifest into `dataset.yaml`. Backend tests verify the range and configured order hours against the prepared data.

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
- **Kaggle's delivery points look generated or shifted.** In 41,513 of 41,944 rows with usable coordinate pairs, the delivery point was offset by nearly the same positive amount in latitude and longitude. OSRM measures a mapped route between those points. The source does not establish how the locations or delivery times were recorded.
- **The sample catalog uses Bengaluru restaurant coordinates from Zomato rows with usable routes.** Restaurant names, cuisines, and ratings are examples. Validation metrics cover the dataset's held-out orders across Indian cities.

## Changing the features

1. Add the column to `serving.model_features` and `SUPPORTED_MODEL_COLUMNS`.
2. Add it to `PredictionRequest`, `DeliveryFeatures`, and `to_model_input()`.
3. Add its pandas type to `MODEL_INPUT_DTYPES` in `model.py`.
4. Add it to [`types/prediction.ts`](../apps/web/src/types/prediction.ts) and [`prediction-request.ts`](../apps/web/src/lib/prediction-request.ts).
