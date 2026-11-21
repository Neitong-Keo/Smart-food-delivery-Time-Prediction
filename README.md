# Smart Food Delivery Time Prediction

This project aims to predict food delivery times from route distance, traffic, and weather. Phase 1 provides a Next.js route explorer with illustrative ETAs, a FastAPI health endpoint, and a Python scaffold for data ingestion and model training. You can run the demo without a CSV or a trained model.

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

Run the Python smoke tests before adding the dataset or a model artifact. The suite checks the health response, default CORS policy, ML paths, and the scaffold commands.

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

## ML scaffold

[Dataset configuration](apps/backend/ml/configs/dataset.yaml) resolves paths relative to `apps/backend/ml/`. For future dataset work, place the source CSV at `apps/backend/ml/data/raw/dataset.csv`. The target column and feature mappings are pending verification of the CSV headers. Git ignores local datasets and generated artifacts in the configured directories.

From `apps/backend`, run the scaffold entry points below. Both print a Phase 1 implementation message and exit nonzero.

```powershell
.\.venv\Scripts\python.exe -m ml.scripts.ingest
.\.venv\Scripts\python.exe -m ml.scripts.train
```

The configuration reserves `data/processed/dataset.parquet`, `data/manifests/dataset.json`, and `artifacts/v1/` for future outputs.

## Repository layout

| Path | Contents |
| --- | --- |
| [`apps/web/`](apps/web/) | Next.js frontend, route explorer, theme toggle, and onboarding |
| [`apps/backend/app/`](apps/backend/app/) | FastAPI application, configuration, and health endpoint |
| [`apps/backend/ml/`](apps/backend/ml/) | Dataset paths and ML workflow scaffold |
| [`apps/backend/tests/`](apps/backend/tests/) | API and ML scaffold smoke tests |
| [`docs/architecture.md`](docs/architecture.md) | Service and ML package boundaries |
| [`infra/README.md`](infra/README.md) | Container setup |
