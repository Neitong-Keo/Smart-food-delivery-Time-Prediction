"""CLI entry point for cleaning and profiling a delivery dataset."""

import argparse
import csv
import sys
from pathlib import Path

from ml.ingestion import run_ingestion


def main(argv: list[str] | None = None) -> int:
    """Parse arguments and run the ingestion workflow."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input", type=Path, help="Source CSV path (default from ml/configs/dataset.yaml)."
    )
    args = parser.parse_args(argv)
    try:
        report = run_ingestion(input_path=args.input)
    except (OSError, ValueError, csv.Error) as exc:
        print(f"[ml.scripts.ingest] {exc}", file=sys.stderr)
        return 1

    print(
        f"Cleaned {report['input_rows']:,} input rows into {report['output_rows']:,} output rows."
    )
    print("Wrote the configured Parquet dataset and JSON data-quality report.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

