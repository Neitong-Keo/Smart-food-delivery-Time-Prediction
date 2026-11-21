"""CLI entry point for the chronological median baseline."""

import sys

from ml.train import run_training


def main() -> int:
    """Run the baseline and report the split and validation metric."""
    try:
        result = run_training()
    except (OSError, ValueError) as exc:
        print(f"[ml.scripts.train] {exc}", file=sys.stderr)
        return 1

    split = result.split
    print(
        f"Excluded timestamps: {split.missing_timestamps:,} missing, "
        f"{split.invalid_timestamps:,} invalid."
    )
    print(split.summary().to_string())
    print(f"Training median: {result.training_median:.6f} minutes")
    print(f"Validation MAE: {result.validation_mae:.6f} minutes")
    print("Test set reserved for final evaluation.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

