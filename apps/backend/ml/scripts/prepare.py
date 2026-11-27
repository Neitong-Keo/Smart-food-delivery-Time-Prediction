"""Export encoded train, validation, and test rows to the prepared Parquet file."""

import sys

from ml.prepared_data import run_preparation


def main() -> int:
    try:
        path = run_preparation()
    except (OSError, ValueError) as exc:
        print(f"[ml.scripts.prepare] {exc}", file=sys.stderr)
        return 1

    print(f"Wrote prepared data to {path}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
