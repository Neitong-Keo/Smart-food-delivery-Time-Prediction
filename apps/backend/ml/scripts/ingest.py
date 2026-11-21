"""CLI entry point for dataset ingestion: `python -m ml.scripts.ingest`."""

import sys

from ml.ingestion import run_ingestion


def main() -> int:
    """Execute dataset ingestion and return a process exit code."""
    try:
        run_ingestion()
    except NotImplementedError as exc:
        print(f"[ml.scripts.ingest] {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

