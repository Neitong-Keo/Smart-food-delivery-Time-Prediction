"""Train and evaluate Linear Regression and Random Forest against the median baseline."""

import argparse
import sys
from pathlib import Path

from ml.regressor_comparison import OUTPUT_DIR, compare_regressors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=OUTPUT_DIR,
        help="Destination for models and evaluation files",
    )
    args = parser.parse_args()

    try:
        summary = compare_regressors(args.output_dir)
    except (OSError, ValueError) as exc:
        print(f"[ml.scripts.compare_regressors] {exc}", file=sys.stderr)
        return 1

    print(
        summary.drop(columns="parameters").to_string(
            index=False,
            na_rep="undefined",
            float_format="{:.3f}".format,
        )
    )
    print(f"Saved fitted pipelines and evaluation files to {args.output_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
