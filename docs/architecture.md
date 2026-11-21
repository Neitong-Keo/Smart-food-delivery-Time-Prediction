# Project overview and architecture

The project aims to estimate food delivery duration in minutes using information available when an order is placed. The current ML workflow prepares the Zomato delivery data and establishes an error benchmark for future models.

## Application architecture

- **Next.js frontend** runs on port `3600`. The TypeScript app includes an illustrative route tour, a `/predict` page for prediction availability, and a `/model` page reserved for evaluation results. [Frontend source](../apps/web/src/)
- **FastAPI backend** runs on port `8600` and exposes `GET /api/health` and interactive API docs. The versioned router is the destination for the future prediction endpoint. [FastAPI application](../apps/backend/app/)
- **ML workflow** lives under `apps/backend/ml/`. This package owns dataset cleaning, data-quality validation, splitting, baseline training, and future model pipeline code. [ML package](../apps/backend/ml/)

## Dataset and workflow

| Repository path | Purpose |
| --- | --- |
| `apps/backend/ml/data/raw/dataset.csv` | Default input. The verified run used `Zomato Dataset.csv` via `--input`. |
| `apps/backend/ml/data/processed/dataset.parquet` | Cleaned dataset with the `delivery_time_minutes` target and `order_timestamp` for splitting. |
| `apps/backend/ml/data/manifests/dataset.json` | Data-quality report covering row counts, rule results, nulls, and schema. |
| `apps/backend/ml/artifacts/v1/` | Destination for the future fitted pipeline and evaluation metrics. |

Run `python -m ml.scripts.ingest` and then `python -m ml.scripts.train` from `apps/backend/` with the backend Python environment active. Ingestion preserves the input CSV and writes the cleaned dataset and quality report. Training uses the configured order-time feature allowlist and divides usable orders chronologically. The raw data and generated outputs are Git-ignored. [Dataset configuration](../apps/backend/ml/configs/dataset.yaml)

## Verified status

| Status | Work | Evidence |
| --- | --- | --- |
| Completed | Service foundation | Next.js provides the route explorer and application routes. FastAPI health and CORS are covered by backend tests. |
| Completed | Dataset audit and cleaning | Ingestion and the audit notebook verified 45,584 input and output rows. The Parquet and quality report are available locally. |
| Completed | Chronological split and median baseline | The CLI and baseline notebook agree on the split sizes and the validation MAE of 7.752280 minutes. |
| In progress | Prediction experience | The prediction and model insights pages show availability messages while live estimates and evaluation results are pending. |
| Remaining | Candidate models and final evaluation | Train and compare the three candidates, evaluate the winner on the test partition, and save the fitted pipeline and metrics. |
| Remaining | Live inference | Add a prediction endpoint and an ETA calculator aligned to the saved pipeline's input schema. |

### Baseline run

The cleaned Parquet contained 45,584 rows. The split excluded 1,731 rows with missing order timestamps, leaving 43,853 usable orders. The baseline predicted the training median of **26 minutes** and achieved a **7.752280-minute validation MAE**. The test partition is held for final evaluation. [Executed baseline notebook](../apps/backend/ml/notebooks/02_baseline_training.ipynb)

| Partition | Rows | First order | Last order |
| --- | ---: | --- | --- |
| Training | 30,698 | 2022-02-11 08:10 | 2022-03-25 17:20 |
| Validation | 6,580 | 2022-03-25 17:25 | 2022-03-31 20:50 |
| Test | 6,575 | 2022-03-31 20:55 | 2022-04-07 00:00 |

## Remaining steps

1. Train Linear Regression, Decision Tree Regression, and Random Forest Regression. Fit any imputation, encoding, scaling, and model parameters using the training partition.
2. Compare each candidate with the baseline on the same validation orders. Choose by validation MAE and use RMSE to check whether large misses dominate the error.
3. Evaluate the selected pipeline once on the held-out test partition. Save the fitted preprocessing and estimator together with versioned metrics and the input schema.
4. Load the pipeline in FastAPI and expose the prediction endpoint. Build the Next.js ETA calculator around the order-time feature contract and connect it to the endpoint.
