# Smart Food Delivery Time Prediction

This project aims to predict food delivery times. It includes a Next.js route explorer with illustrative ETAs, a FastAPI health endpoint, and a Python workflow that cleans and profiles the delivery dataset. You can run the demo without a CSV or a trained model.

[Project overview and architecture](docs/architecture.md)

## Run locally

Use Node.js 20 or newer with npm, and Python 3.11 or newer. Run each block from the repository root in a separate PowerShell terminal.

**FastAPI**

```powershell
Set-Location apps/backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8600
```

**Next.js**

```powershell
Set-Location apps/web
npm.cmd ci
npm.cmd run dev
```

Open [http://localhost:3600](http://localhost:3600). The **FastAPI Health Check** card should display **Online**. Use **Recheck API** if you started FastAPI after opening the page.

| API endpoint | Expected result |
| --- | --- |
| [GET /api/health](http://localhost:8600/api/health) | HTTP 200 with `{"status":"ok"}` |
| [GET /docs](http://localhost:8600/docs) | Interactive API documentation |

The frontend defaults to `http://localhost:8600` and FastAPI allows requests from `http://localhost:3600`. If you change either URL, set `NEXT_PUBLIC_API_BASE_URL` for the web process and `CORS_ALLOW_ORIGINS` for the API process before starting them. The API accepts a comma-separated list of origins. Use the frontend's exact origin, including the hostname and port.

## Run with Docker Compose

With Docker Desktop running, execute these commands from the repository root.

```powershell
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
curl.exe --fail http://localhost:8600/api/health
```

Compose uses the same default URLs as the local setup. To override them, copy `.env.example` to `.env` and edit the values before building. The frontend embeds `NEXT_PUBLIC_API_BASE_URL` during the build, so rebuild after changing it. Run `docker compose down` from the repository root to stop the services.

## Run tests and build

The Python suite uses fixtures to check dataset cleaning, feature selection, and Parquet and report output. It also checks the FastAPI health response and default CORS policy.

```powershell
# From the repository root, after installing the backend dependencies
Push-Location apps/backend
.\.venv\Scripts\python.exe -m pytest
Pop-Location
```

```powershell
# From the repository root, after installing the web dependencies
Push-Location apps/web
npm.cmd run typecheck
npm.cmd run build
Pop-Location
```

## Clean and profile the dataset

[Dataset configuration](apps/backend/ml/configs/dataset.yaml) defines the expected headers, quality rules, output paths, and feature allowlist. The default source is `apps/backend/ml/data/raw/dataset.csv`.

From `apps/backend`, run one of these commands after installing the backend dependencies.

```powershell
.\.venv\Scripts\python.exe -m ml.scripts.ingest
.\.venv\Scripts\python.exe -m ml.scripts.ingest --input "ml/data/raw/Zomato Dataset.csv"
```

The command writes `ml/data/processed/dataset.parquet` and `ml/data/manifests/dataset.json`. The report includes raw profiles, row reconciliation, quality flags, remaining nulls, and the final schema. Git ignores the raw CSV and generated outputs.

`distance_km` is a straight-line estimate. Missing or invalid coordinate pairs and distances above 100 km produce a null distance. The dataset retains order timestamps for the chronological split.

## Run the median baseline

From `apps/backend/`, run this after creating the cleaned Parquet.

```powershell
.\.venv\Scripts\python.exe -m ml.scripts.train
```

The command reports timestamp exclusions, chronological split sizes and date ranges, the training median, and validation mean absolute error. The newest partition is held for final evaluation. [Baseline training notebook](apps/backend/ml/notebooks/02_baseline_training.ipynb)

## Repository layout

| Path | Contents |
| --- | --- |
| [`apps/web/`](apps/web/) | Next.js frontend, route explorer, theme toggle, and onboarding |
| [`apps/backend/app/`](apps/backend/app/) | FastAPI application, configuration, and health endpoint |
| [`apps/backend/ml/`](apps/backend/ml/) | Dataset configuration, cleaning, notebooks, and baseline training |
| [`apps/backend/tests/`](apps/backend/tests/) | API, ingestion, and baseline tests |
| [`docs/architecture.md`](docs/architecture.md) | Project overview, architecture, and status |
| [`infra/README.md`](infra/README.md) | Container setup |
