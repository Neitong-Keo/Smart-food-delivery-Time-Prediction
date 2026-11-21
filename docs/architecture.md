# Phase 1 Architecture Overview

Smart Food Delivery Time Prediction is organized as a single monorepo with two applications:

- `apps/web/`: Next.js App Router (TypeScript) frontend running on port `3600`.
- `apps/backend/`: FastAPI service running on port `8600`, which also owns the `ml/` package for future scikit-learn ingestion, training, evaluation, and inference.

## Key Boundaries

1. **HTTP Layer (`apps/backend/app/`)**
   - `app/main.py`: FastAPI application factory, CORS middleware, `/api/health`, and v1 router mounting.
   - `app/api/v1/`: Reserved for versioned API endpoints (e.g., prediction endpoints in later phases).
   - `app/core/`: Environment-driven settings and logging configuration.
   - `app/schemas/`: Pydantic request and response models.
   - `app/services/`: HTTP-facing orchestration and prediction services that call into `ml/`.

2. **ML Package (`apps/backend/ml/`)**
   - Regular Python package inside `apps/backend/` using the backend Python environment.
   - Reusable modules live directly under `ml/` (`ingestion.py`, `validation.py`, `preprocessing.py`, `pipeline.py`, `train.py`, `evaluate.py`, `manifest.py`).
   - Thin CLI entry points live in `ml/scripts/` (`python -m ml.scripts.ingest`, `python -m ml.scripts.train`).
   - Data and model artifact directories are tracked via `.gitkeep` while generated data and binaries are gitignored.

