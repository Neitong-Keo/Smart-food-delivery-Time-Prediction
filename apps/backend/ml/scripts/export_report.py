"""Export the dataset and training evidence as JSON for the web app's technical report."""

import argparse
import sys
from pathlib import Path

from ml import ML_BASE_DIR
from ml.report import export_report

DEFAULT_OUTPUT = ML_BASE_DIR.parents[1] / "web" / "public" / "report"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path, default=DEFAULT_OUTPUT, help=f"Folder to write to (default: {DEFAULT_OUTPUT})."
    )
    args = parser.parse_args()
    try:
        written = export_report(args.output)
    except (OSError, ValueError, KeyError) as exc:
        print(f"[ml.scripts.export_report] {exc}", file=sys.stderr)
        return 1
    for path in written:
        print(f"Wrote {path} ({path.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
