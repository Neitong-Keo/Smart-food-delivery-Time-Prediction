"""CLI that adds actual road distances to the cleaned dataset."""

import argparse
import os
import sys
from urllib.parse import urlparse

from ml.routes import RouteServiceError, run_enrichment

PUBLIC_OSRM_HOSTS = {"router.project-osrm.org", "routing.openstreetmap.de"}
PUBLIC_MIN_DELAY_SECONDS = 1.2


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--routing-url",
        default=os.getenv("ROUTING_URL", "http://localhost:5000"),
        help="OSRM server URL (default: ROUTING_URL or http://localhost:5000).",
    )
    parser.add_argument("--delay", type=float, default=0.0, help="Seconds between requests.")
    parser.add_argument("--table", action="store_true", help="Batch nearby pairs into fastest-route tables.")
    args = parser.parse_args()

    delay = args.delay
    if urlparse(args.routing_url).hostname in PUBLIC_OSRM_HOSTS and delay < PUBLIC_MIN_DELAY_SECONDS:
        delay = PUBLIC_MIN_DELAY_SECONDS
        print(f"Using the public OSRM server at one request every {delay} seconds.")

    try:
        summary = run_enrichment(args.routing_url, delay, use_table=args.table)
    except (OSError, ValueError, RouteServiceError) as exc:
        print(f"[ml.scripts.enrich_routes] {exc}", file=sys.stderr)
        print("Completed routes are cached. Run the command again to continue.", file=sys.stderr)
        return 1

    print(f"Rows: {summary.rows:,}. With valid coordinates: {summary.usable_rows:,}.")
    print(f"Rows with a road distance: {summary.routed_rows:,} from {summary.unique_routes:,} unique routes.")
    if summary.min_road_km is not None:
        print(f"Mapped road distances: {summary.min_road_km:.2f} to {summary.max_road_km:.2f} km.")
        print("Use the training manifest's fitted range for serving.training_road_distance_km.")
    if summary.failed_routes:
        print(f"{summary.failed_routes:,} requests failed. Run the command again to retry them.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
