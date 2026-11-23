"""Train Decision Tree and XGBoost on road distances, evaluate, and export the winner."""

import sys

from ml.model_training import run_model_training


def main() -> int:
    try:
        report = run_model_training()
    except (OSError, ValueError) as exc:
        print(f"[ml.scripts.train_models] {exc}", file=sys.stderr)
        return 1

    for name, scores in report["validation"].items():
        print(
            f"{name}: validation MAE {scores['mae']:.3f} min, "
            f"RMSE {scores['rmse']:.3f} min, R² {scores['r2']:.3f}"
        )
    name, test = report["model_name"], report["test"]
    print(f"{name}: test MAE {test['mae']:.3f} min, RMSE {test['rmse']:.3f} min, R² {test['r2']:.3f}")
    print("Saved the model, metrics, evaluation plot, and test predictions under ml/artifacts/v1/.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
