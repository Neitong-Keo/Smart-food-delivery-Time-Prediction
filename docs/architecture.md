# Project overview and architecture

The project estimates food delivery duration in minutes using only information available when an order is placed. It has two parts: a **demo** that predicts a delivery time for a live order, and a **technical report** that explains how the model was built.

## Application architecture

- **Next.js frontend** runs on port `3600`. [Frontend source](../apps/web/src/)
  - **Demo**: `/` (landing) → `/restaurants` → `/delivery` (map) → `/predict`. The predict page lets you choose the order time and compare the three models for the same order. `/history` (browser-stored past predictions) and `/explore` (an illustrative route explorer that doesn't use the model) are linked from the footer.
  - **Technical**: `/technical` and seven sections in reading order: `/data`, `/eda`, `/outliers`, `/split`, `/training`, `/evaluation` and `/slides`. They share a sidebar layout in [`app/technical/layout.tsx`](../apps/web/src/app/technical/layout.tsx). Charts read precomputed JSON from [`public/report/`](../apps/web/public/report/). The dataset table reads pages from the API.
  - API, map and history access live in `src/services/`, with state in `src/hooks/`. Chart components are plain SVG in `src/components/charts/`.
- **FastAPI backend** runs on port `8600`. It exposes health, restaurants, predictions, the model list and the dataset table. Restaurants sit behind a repository. Predictions sit behind a `Predictor` interface with demo and trained-model implementations, and a `ModelRegistry` holds every model the API serves. [FastAPI application](../apps/backend/app/)
- **Map services** are called from the browser and need no keys: OpenFreeMap tiles rendered with MapLibre, Photon for address search, and OSRM for actual road routes. The map, search and pins are limited to the Bengaluru delivery area in the dataset (`DELIVERY_AREA_BOUNDS` in [`config.ts`](../apps/web/src/lib/config.ts)). [Map services](../apps/web/src/services/maps/)
- **ML workflow** lives under `apps/backend/ml/`: cleaning, data-quality validation, road route enrichment, the chronological split, training, and the report export. [ML package](../apps/backend/ml/)

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Service health |
| `GET /api/restaurants`, `GET /api/restaurants/{id}` | Sample restaurants |
| `POST /api/predict/preview` | The exact model inputs and any range warnings |
| `POST /api/predict` | Predict with the selected model, or the one named by `model_id` |
| `POST /api/predict/compare` | Every served model's prediction for one order |
| `GET /api/models` | Served models with their validation and test scores |
| `GET /api/model` | Selected predictor, input columns, limits and summary metrics |
| `GET /api/dataset`, `GET /api/dataset/download` | A page of the cleaned or raw dataset, or every matching row as CSV |

## Dataset and workflow

| Repository path | Purpose |
| --- | --- |
| `apps/backend/ml/data/raw/Zomato Dataset.csv` | Source CSV from Kaggle. |
| `apps/backend/ml/data/processed/dataset.parquet` | Cleaned dataset with the `delivery_time_minutes` target and `order_timestamp` for splitting. |
| `apps/backend/ml/data/processed/dataset_with_routes.parquet` | Cleaned dataset plus the OSRM `road_distance_km` for each order. This is the training file. |
| `apps/backend/ml/data/manifests/dataset.json` | Data-quality report covering row counts, rule results, nulls and schema. |
| `apps/backend/ml/artifacts/v1/` | Selected pipeline (`model.joblib`), every refitted candidate (`models/`), `manifest.json`, `metrics.json`, test predictions and the evaluation chart. Git-ignored. |
| `apps/web/public/report/` | `eda.json`, `outliers.json` and `model.json` for the technical pages. |

Run these from `apps/backend/` with the backend Python environment:

1. `python -m ml.scripts.ingest` cleans the CSV and writes the quality report.
2. `python -m ml.scripts.enrich_routes` adds the actual road distance for each order.
3. `python -m ml.scripts.train_models` trains and compares the models and saves all of them.
4. `python -m ml.scripts.export_report` writes the JSON for the technical pages.

Training uses `serving.model_features` in [`dataset.yaml`](../apps/backend/ml/configs/dataset.yaml): order type, festival, city type, order hour, day of the week and road distance. Weather, traffic and rider fields aren't used because they aren't known when the customer orders.

## Models and results

Three models are trained on the same chronological split: 25,489 training, 5,464 validation and 5,463 test orders out of 36,416 usable ones. Each model's settings are chosen by validation MAE. Every model is then refitted on training and validation orders and scored once on the test orders.

| Model | Settings | Validation MAE | Test MAE | Test RMSE | Test R² |
| --- | --- | ---: | ---: | ---: | ---: |
| Median baseline | Training median | 7.77 | 7.30 | 9.17 | -0.01 |
| Decision Tree | Depth 8, at least 20 orders per leaf | 6.25 | 6.11 | 7.64 | 0.30 |
| **XGBoost** (selected) | Depth 5, learning rate 0.03, 300 trees | **6.16** | **6.04** | **7.56** | **0.32** |

XGBoost has the lowest validation error, so the API serves it by default. Order hour matters most, then road distance and festival. All models underestimate the longest deliveries; see the [evaluation page](../apps/web/src/app/technical/evaluation/page.tsx) and the [integration guide](ml-integration.md).

## Status

| Status | Work |
| --- | --- |
| Completed | Dataset audit and cleaning: 45,584 rows in and out, documented in the audit notebook. |
| Completed | Road distances: 37,700 orders have an OSRM route. |
| Completed | Median baseline, Decision Tree and XGBoost trained, compared and saved. |
| Completed | Model serving: the API loads all saved models, checks their columns and applies the input limits. |
| Completed | Demo app with map limits, an order time picker and a model picker. |
| Completed | Technical report pages and in-app slides. |
| Open | Whether to keep `/history` and `/explore`, and which slide format to embed. See the handoff questions. |
