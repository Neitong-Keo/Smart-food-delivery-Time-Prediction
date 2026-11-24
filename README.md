# Smart Food Delivery Time Prediction

A food delivery web app that estimates how long an order will take, in two parts:

- **Demo**: choose a Bengaluru restaurant, drop a pin on the map, pick when the order is placed, and compare what the median baseline, a Decision Tree and XGBoost predict.
- **Technical**: a report that walks through the [Zomato delivery dataset](https://www.kaggle.com/datasets/saurabhbadole/zomato-delivery-operations-analytics-dataset), the exploratory analysis, outliers and cleaning, the data split, training, evaluation and the presentation slides.

The repository also contains the Python workflow that prepares the data and trains the models.

The app runs without a dataset, a trained model, or any API keys. **Delivery times are labelled as demo results until the trained model is connected.**

- [Connect the trained model](docs/ml-integration.md)
- [Project overview and architecture](docs/architecture.md)

## What you need

- [Node.js](https://nodejs.org) 20 or newer, with npm
- [Python](https://www.python.org/downloads/) 3.11 or newer
- An internet connection for the map, address search, and road routes
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), only if you want to run with containers

The commands below are for Windows PowerShell. On macOS or Linux, use `.venv/bin/python` instead of `.\.venv\Scripts\python.exe`, and `npm` instead of `npm.cmd`.

## Set up the project

Do this once after cloning. Run each block from the repository root.

**1. Install the backend**

```powershell
Set-Location apps/backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Set-Location ../..
```

**2. Install the frontend**

```powershell
Set-Location apps/web
npm.cmd ci
Set-Location ../..
```

No `.env` file is needed for local development.

## Run the application

Open two terminals at the repository root and leave both running.

**Terminal 1: API**

```powershell
Set-Location apps/backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8600
```

**Terminal 2: website**

```powershell
Set-Location apps/web
npm.cmd run dev
```

Open [http://localhost:3600](http://localhost:3600), then:

1. Select **Start demo** and choose a restaurant.
2. Search for an address or click the map. Drag the pin to adjust it. The map stays inside the Bengaluru delivery area from the dataset.
3. Select **Confirm delivery location**.
4. Choose the order type and the order time (now, or a day and time in the restaurant's time zone), then select **Predict delivery time**.
5. Switch between models to see each one's prediction. The table under the result lists all three.
6. Open **Technical** for the report, or **Prediction history** in the footer for past predictions.

Press `Ctrl+C` in each terminal to stop the app.

## How a delivery time is calculated

| Model input | Where it comes from |
| --- | --- |
| Road distance | Actual route from the restaurant to the customer, from OSRM |
| Order hour and weekday | The chosen order time, or now, in the restaurant's local time |
| Order type | Meal, snack, drinks, or buffet |
| Festival | Checkbox on the prediction page |
| Area type | Metropolitan, urban, or semi-urban, stored on the restaurant |

- Road distance is never estimated from a straight line. If a road route can't be found, the app asks the customer to retry or move the pin.
- The app warns when an order is outside the range of the training data, and declines deliveries beyond the limits in [`dataset.yaml`](apps/backend/ml/configs/dataset.yaml).
- Drive time is shown for reference. It doesn't include live traffic and isn't a model input by default.

## Connect the trained model

The API serves every model the training command saves. Use model mode for the demo, so predictions come from the trained models instead of the demo rule.

1. Add road distances to the training data, as described in [Prepare the training data](#prepare-the-training-data).
2. Run the model training command. It trains the median baseline, Decision Tree and XGBoost, and saves all three.
3. Check `apps/backend/ml/artifacts/v1/` for `model.joblib` (the selected model), `models/` (every model), the metrics and the evaluation chart.
4. Restart the API in model mode:

   ```powershell
   Set-Location apps/backend
   $env:PREDICTION_MODE = "model"
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8600
   ```

5. Open **Technical → Evaluation**. Under **What the running API serves now**, all three models should be **Live**.

The frontend needs no changes. See the [integration guide](docs/ml-integration.md) for the training code and checks.

## Prepare the training data

The raw CSV is included at `apps/backend/ml/data/raw/Zomato Dataset.csv`. [Dataset source on Kaggle](https://www.kaggle.com/datasets/saurabhbadole/zomato-delivery-operations-analytics-dataset)

Run these commands from `apps/backend`.

**1. Clean the dataset**

```powershell
.\.venv\Scripts\python.exe -m ml.scripts.ingest --input "ml/data/raw/Zomato Dataset.csv"
```

This writes `ml/data/processed/dataset.parquet` and a data-quality report.

**2. Add actual road distances**

The dataset only has coordinates, so this step requests the road route for each unique restaurant and delivery pair. Use a [local OSRM server](docs/ml-integration.md#run-a-local-osrm-server) if you can:

```powershell
.\.venv\Scripts\python.exe -m ml.scripts.enrich_routes --routing-url http://localhost:5000
```

Or use the shared public server, which is limited to one request about every second and may take over an hour:

```powershell
.\.venv\Scripts\python.exe -m ml.scripts.enrich_routes --routing-url https://router.project-osrm.org
```

For a one-off run using an OSRM server that supports Table distances, add `--table` to group nearby trips into small requests. Table mode uses the fastest mapped route. The app and the default training route command can prefer a ferry-free alternative. With `--table`, the public server needs only about 90 requests (around two minutes) for the 4,360 unique routes.

Completed routes are cached, so you can stop and rerun the command. The route file is `ml/data/processed/dataset_with_routes.parquet`. Use the fitted range reported in the training manifest for `serving.training_road_distance_km` in [`dataset.yaml`](apps/backend/ml/configs/dataset.yaml).

**3. Train and evaluate the models**

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-training.txt
.\.venv\Scripts\python.exe -m ml.scripts.train_models
```

This tunes each model on the validation orders and selects the one with the lowest validation mean absolute error. It refits every model on training and validation orders, scores each once on the newest orders, and writes these files under `ml/artifacts/v1/`:

- `model.joblib`: the selected model, which the API uses by default
- `models/median.joblib`, `models/decision_tree.joblib`, `models/xgboost.joblib`: every model, for the demo's model picker
- `manifest.json`: the split, tuning results, and validation and test scores for every model
- `metrics.json`, `evaluation.png` and `test_predictions.csv` (one prediction column per model)

**4. Export the report data**

```powershell
.\.venv\Scripts\python.exe -m ml.scripts.export_report
```

This writes `eda.json`, `outliers.json` and `model.json` to `apps/web/public/report/` for the technical pages. Commit them after retraining, then rebuild the website.

The original median baseline also runs on the cleaned data before routing:

```powershell
.\.venv\Scripts\python.exe -m ml.scripts.train
```

The model training command reruns the median baseline on the same road-distance split as both candidates, so use that run for model comparisons.

## Configuration

The defaults work for local development. Set API variables in the terminal before starting it. Put website variables in `apps/web/.env.local`, then restart the website. For Docker Compose, copy `.env.example` to `.env`.

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `PREDICTION_MODE` | API | `demo` | `demo` or `model` |
| `MODEL_PATH` | API | `ml/artifacts/v1/model.joblib` | Use a model file in another location |
| `CORS_ALLOW_ORIGINS` | API | `http://localhost:3600` | Comma-separated website origins |
| `NEXT_PUBLIC_API_BASE_URL` | Website | `http://localhost:8600` | API address |
| `NEXT_PUBLIC_PREDICTION_MODE` | Website | `api` | `mock` returns demo times without calling `/api/predict` |
| `NEXT_PUBLIC_MAP_STYLE_LIGHT_URL` | Website | OpenFreeMap Positron | Light map style |
| `NEXT_PUBLIC_MAP_STYLE_DARK_URL` | Website | OpenFreeMap Dark | Dark map style |
| `NEXT_PUBLIC_GEOCODING_URL` | Website | `https://photon.komoot.io` | Address search |
| `NEXT_PUBLIC_ROUTING_URL` | Website | `https://router.project-osrm.org` | Road routes |

The map services are free, need no accounts, and are shared public servers with no uptime guarantee. Delivery coordinates and searched addresses are sent to them. For a real product, host your own Photon and OSRM servers.

## API

| Endpoint | Purpose |
| --- | --- |
| [GET /api/health](http://localhost:8600/api/health) | Service health |
| [GET /api/restaurants](http://localhost:8600/api/restaurants) | List restaurants, with optional `search` and `cuisine` filters |
| [GET /api/restaurants/{id}](http://localhost:8600/api/restaurants/restaurant_001) | One restaurant and its coordinates |
| POST /api/predict/preview | The exact model inputs and any range warnings |
| POST /api/predict | Predict a delivery time. Add `model_id` to choose a model |
| POST /api/predict/compare | Every model's prediction for one order |
| [GET /api/models](http://localhost:8600/api/models) | Models the API serves, with validation and test scores |
| [GET /api/dataset](http://localhost:8600/api/dataset) | One page of the cleaned or raw dataset, with `page`, `page_size`, `sort`, `order`, `search` and filters |
| GET /api/dataset/download | Every matching dataset row as CSV |
| [GET /api/model](http://localhost:8600/api/model) | Active predictor, input columns, limits, and metrics |
| [GET /docs](http://localhost:8600/docs) | Interactive API documentation |

The [sample restaurants](apps/backend/app/data/sample_restaurants.json) use Bengaluru coordinates from the Zomato dataset with fictional names and ratings. To use a database, implement `RestaurantRepository` in [`restaurants.py`](apps/backend/app/repositories/restaurants.py). History is stored in the browser behind [`PredictionHistoryRepository`](apps/web/src/services/history/history.repository.ts).

## Run with Docker Compose

With Docker Desktop running, execute these commands from the repository root.

```powershell
docker compose up --build -d --wait
docker compose ps
curl.exe --fail http://localhost:8600/api/health
```

Open [http://localhost:3600](http://localhost:3600). Run `docker compose down` to stop.

Compose mounts `apps/backend/ml/artifacts`, so the saved models are available inside the API container. Set `PREDICTION_MODE=model` in `.env` to use them. The API image includes the source CSV and the prepared Parquet files for the dataset table, so rebuild it after preparing new data. Website variables are embedded at build time, so run `docker compose up --build` after changing them.

## Run tests and build

```powershell
Push-Location apps/backend
.\.venv\Scripts\python.exe -m pytest
Pop-Location

Push-Location apps/web
npm.cmd run typecheck
npm.cmd run build
Pop-Location
```

Tests that need the real dataset are skipped until the Parquet files exist. Once they do, those tests confirm that the configured limits match the data.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Restaurants can't be loaded | Start the API on port 8600, then select **Try again**. |
| The API is running but the browser is blocked | Set `CORS_ALLOW_ORIGINS` to the website's exact origin and restart the API. |
| Port 3600 or 8600 is in use | Stop the other process, or change the port and update `NEXT_PUBLIC_API_BASE_URL` and `CORS_ALLOW_ORIGINS`. |
| "A road route is needed" | The routing server is busy or unreachable. Select **Try again**, or set `NEXT_PUBLIC_ROUTING_URL` to your own OSRM server. |
| "This pin is too far from a road" | Move the pin onto or next to a street. |
| The map doesn't load | Check your connection. Address search still works if the map tiles are unavailable. |
| A model shows **Couldn't load** on Technical → Evaluation | Read the message next to it. It names the missing file or the columns that don't match. |
| Only one model appears in the model picker | `ml/artifacts/v1/models/` is missing. Rerun `ml.scripts.train_models`. |
| The dataset table says the dataset isn't available | The API can't find the Parquet or CSV files under `ml/data/`. Run the steps in [Prepare the training data](#prepare-the-training-data). |
| Model was trained on `distance_km` | Retrain on `road_distance_km` from `dataset_with_routes.parquet`. |

## Repository layout

| Path | Contents |
| --- | --- |
| [`apps/web/`](apps/web/) | Next.js app: the demo (restaurants, delivery map, prediction, history, route explorer) and the technical report |
| [`apps/web/public/report/`](apps/web/public/report/) | Report data exported by `ml.scripts.export_report` |
| [`apps/backend/app/`](apps/backend/app/) | FastAPI application, restaurant repository, and prediction services |
| [`apps/backend/ml/`](apps/backend/ml/) | Dataset configuration, cleaning, road routes, notebooks, and baseline training |
| [`apps/backend/tests/`](apps/backend/tests/) | API, ingestion, routing, and baseline tests |
| [`docs/ml-integration.md`](docs/ml-integration.md) | How to train and connect the model |
| [`docs/architecture.md`](docs/architecture.md) | Project overview, architecture, and status |
| [`docs/image-credits.md`](docs/image-credits.md) | Sources for the restaurant photos |
| [`infra/README.md`](infra/README.md) | Container setup |
