"""Add actual road distances to the cleaned dataset using an OSRM server."""

import json
import os
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from ml import DEFAULT_DATASET_CONFIG_PATH
from ml.manifest import load_dataset_config, resolve_dataset_paths

COORDINATE_COLUMNS = (
    "Restaurant_latitude",
    "Restaurant_longitude",
    "Delivery_location_latitude",
    "Delivery_location_longitude",
)
MAX_CONSECUTIVE_FAILURES = 5
CACHE_SAVE_INTERVAL = 100

Pair = tuple[float, float, float, float]
Route = tuple[float, float] | None
RouteFetcher = Callable[[Pair], Route]


class RouteServiceError(RuntimeError):
    """The routing server could not answer a request."""


@dataclass(frozen=True)
class EnrichmentSummary:
    """Coverage and road distance range for one enrichment run."""

    rows: int
    usable_rows: int
    routed_rows: int
    unique_routes: int
    failed_routes: int
    min_road_km: float | None
    max_road_km: float | None


def fetch_route(base_url: str, pair: Pair, max_point_to_road_m: float, timeout: float = 20) -> Route:
    """Return (road km, drive minutes), or None when the pair has no usable road route."""
    lat1, lon1, lat2, lon2 = pair
    url = (
        f"{base_url.rstrip('/')}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}"
        "?overview=false&alternatives=true&steps=true"
    )
    request = urllib.request.Request(url, headers={"User-Agent": "delivery-eta-training"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 400:
            try:
                code = json.load(error).get("code")
            except ValueError:
                code = None
            if code in {"NoRoute", "NoSegment"}:
                return None
        raise RouteServiceError(f"Routing server returned HTTP {error.code}.") from error
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        raise RouteServiceError(f"Routing server request failed: {error}") from error

    if payload.get("code") != "Ok" or not payload.get("routes"):
        return None
    if max(point.get("distance", 0) for point in payload["waypoints"]) > max_point_to_road_m:
        return None

    routes = payload["routes"]
    no_ferry = [
        route
        for route in routes
        if not any(step.get("mode") == "ferry" for leg in route["legs"] for step in leg["steps"])
    ]
    route = (no_ferry or routes)[0]
    return route["distance"] / 1000, route["duration"] / 60


def _key(pair: Pair) -> str:
    return ",".join(f"{value:.6f}" for value in pair)


def enrich_records(
    records: pd.DataFrame,
    fetch: RouteFetcher,
    cache: dict[str, list[float] | None],
    *,
    delay_seconds: float = 0.0,
    on_checkpoint: Callable[[], None] | None = None,
) -> tuple[pd.DataFrame, EnrichmentSummary]:
    """Add road_distance_km and route_duration_minutes, requesting each unique pair once.

    Rows without a valid cleaned distance keep null route values. Failed requests
    are left out of the cache so the next run retries them.
    """
    columns = list(COORDINATE_COLUMNS)
    usable = records["distance_km"].notna() & records[columns].notna().all(axis=1)
    pairs = [
        tuple(float(value) for value in row)
        for row in records.loc[usable, columns].itertuples(index=False, name=None)
    ]
    keys = [_key(pair) for pair in pairs]
    unique = dict(zip(keys, pairs))

    failed = consecutive = requested = 0
    for key, pair in unique.items():
        if key in cache:
            continue
        try:
            route = fetch(pair)
        except RouteServiceError:
            failed += 1
            consecutive += 1
            if consecutive >= MAX_CONSECUTIVE_FAILURES:
                if on_checkpoint:
                    on_checkpoint()
                raise
        else:
            consecutive = 0
            cache[key] = list(route) if route else None
            requested += 1
            if on_checkpoint and requested % CACHE_SAVE_INTERVAL == 0:
                on_checkpoint()
        if delay_seconds:
            time.sleep(delay_seconds)
    if on_checkpoint:
        on_checkpoint()

    distances = pd.Series(pd.NA, index=records.index, dtype="Float64")
    durations = pd.Series(pd.NA, index=records.index, dtype="Float64")
    for index, key in zip(records.index[usable], keys):
        route = cache.get(key)
        if route:
            distances.at[index] = route[0]
            durations.at[index] = route[1]

    enriched = records.assign(road_distance_km=distances, route_duration_minutes=durations)
    routed = int(distances.notna().sum())
    return enriched, EnrichmentSummary(
        rows=len(records),
        usable_rows=int(usable.sum()),
        routed_rows=routed,
        unique_routes=len(unique),
        failed_routes=failed,
        min_road_km=float(distances.min()) if routed else None,
        max_road_km=float(distances.max()) if routed else None,
    )


def _write_json(path: Path, data: dict[str, list[float] | None]) -> None:
    staged = path.with_suffix(".tmp")
    staged.write_text(json.dumps(data), encoding="utf-8")
    os.replace(staged, path)


def run_enrichment(
    routing_url: str,
    delay_seconds: float = 0.0,
    config_path: Path = DEFAULT_DATASET_CONFIG_PATH,
) -> EnrichmentSummary:
    """Read the cleaned Parquet and write a copy with road route columns."""
    config = load_dataset_config(config_path)
    paths = resolve_dataset_paths(config_path)
    if not paths.processed_parquet.is_file():
        raise FileNotFoundError(
            f"Cleaned Parquet is missing at '{paths.processed_parquet}'. "
            "Run 'python -m ml.scripts.ingest' first."
        )

    cache_path = paths.base_dir / config["paths"]["route_cache"]
    output_path = paths.base_dir / config["paths"]["routed_parquet"]
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.is_file() else {}
    max_point_to_road_m = float(config["serving"]["max_point_to_road_m"])

    records = pd.read_parquet(paths.processed_parquet)
    enriched, summary = enrich_records(
        records,
        lambda pair: fetch_route(routing_url, pair, max_point_to_road_m),
        cache,
        delay_seconds=delay_seconds,
        on_checkpoint=lambda: _write_json(cache_path, cache),
    )
    staged = output_path.with_suffix(".tmp")
    enriched.to_parquet(staged, index=False)
    os.replace(staged, output_path)
    return summary
