"""Fetch nearby road routes in small OSRM Table requests."""

import json
import time
import urllib.error
import urllib.request
from collections import defaultdict
from collections.abc import Iterable, Iterator

from ml.routes import Pair, RouteServiceError, _key

MAX_POINTS = 80
MAX_ORIGINS = 5


def group_table_pairs(pairs: Iterable[Pair]) -> Iterator[list[Pair]]:
    """Keep each table local and bound the number of paths it computes."""
    regions = defaultdict(lambda: defaultdict(list))
    for pair in pairs:
        lat, lon, _, _ = pair
        regions[int(lat), int(lon)][pair[:2]].append(pair)

    for origins in regions.values():
        batch: list[Pair] = []
        sources: set[tuple[float, float]] = set()
        points: set[tuple[float, float]] = set()
        for origin_pairs in origins.values():
            for pair in origin_pairs:
                source, destination = pair[:2], pair[2:]
                if len(points | {source, destination}) > MAX_POINTS or len(sources | {source}) > MAX_ORIGINS:
                    yield batch
                    batch = []
                    sources = set()
                    points = set()
                batch.append(pair)
                sources.add(source)
                points.update((source, destination))
        if batch:
            yield batch


def fetch_route_table(
    base_url: str, pairs: list[Pair], max_snap_m: float, delay_seconds: float,
) -> dict[str, list[float] | None]:
    """Read fastest-route distances and return only the requested pairs."""
    sources = {point: i for i, point in enumerate(dict.fromkeys(pair[:2] for pair in pairs))}
    destinations = {point: i for i, point in enumerate(dict.fromkeys(pair[2:] for pair in pairs))}
    coordinates = {point: i for i, point in enumerate(dict.fromkeys([*sources, *destinations]))}
    points = ";".join(f"{lon:.6f},{lat:.6f}" for lat, lon in coordinates)
    source_ids = ";".join(str(coordinates[point]) for point in sources)
    destination_ids = ";".join(str(coordinates[point]) for point in destinations)
    url = (
        f"{base_url.rstrip('/')}/table/v1/driving/{points}?sources={source_ids}"
        f"&destinations={destination_ids}&annotations=distance,duration&generate_hints=false"
    )
    request = urllib.request.Request(url, headers={"User-Agent": "Smart-Food-Delivery-School-Project/1.0"})
    if delay_seconds:
        time.sleep(delay_seconds)
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        try:
            code = json.load(error).get("code")
        except ValueError:
            code = None
        if error.code == 400 and code == "NoSegment":
            if len(pairs) == 1:
                return {_key(pairs[0]): None}
            middle = len(pairs) // 2
            first = fetch_route_table(base_url, pairs[:middle], max_snap_m, delay_seconds)
            return first | fetch_route_table(base_url, pairs[middle:], max_snap_m, delay_seconds)
        raise RouteServiceError(f"OSRM Table returned HTTP {error.code} ({code or 'unknown error'}).") from error
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        raise RouteServiceError(f"OSRM Table request failed: {error}") from error

    if payload.get("code") != "Ok":
        raise RouteServiceError(f"OSRM Table returned {payload.get('code')!r}.")
    routes = {}
    for pair in pairs:
        origin, destination = sources[pair[:2]], destinations[pair[2:]]
        distance = payload["distances"][origin][destination]
        duration = payload["durations"][origin][destination]
        source_snap = payload["sources"][origin]["distance"]
        destination_snap = payload["destinations"][destination]["distance"]
        route = None
        if max(source_snap, destination_snap) <= max_snap_m and distance is not None and duration is not None:
            route = [distance / 1000, duration / 60]
        routes[_key(pair)] = route
    return routes
