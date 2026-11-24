"""Train the median baseline, Decision Tree and XGBoost on road distances, and export all three."""

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
    for model in report["models"].values():
        test = model["test"]
        marker = " (selected)" if model["selected"] else ""
        print(
            f"{model['name']}{marker}: test MAE {test['mae']:.3f} min, "
            f"RMSE {test['rmse']:.3f} min, R² {test['r2']:.3f}"
        )
    print(
        "Saved the selected model, every refitted candidate under models/, metrics, "
        "evaluation plot, and test predictions under ml/artifacts/v1/."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
