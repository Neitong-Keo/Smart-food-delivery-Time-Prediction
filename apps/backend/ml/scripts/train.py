"""CLI entry point for model training: `python -m ml.scripts.train`."""

import sys

from ml.train import run_training


def main() -> int:
    """Execute model training and return a process exit code."""
    try:
        run_training()
    except NotImplementedError as exc:
        print(f"[ml.scripts.train] {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

