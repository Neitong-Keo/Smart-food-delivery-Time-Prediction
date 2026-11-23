"""Tests for adding actual road distances to the training data."""

import io
import json

import pandas as pd
import pytest

from ml import routes
from ml.routes import RouteServiceError, enrich_records, fetch_route

PAIR = (11.0, 76.0, 11.05, 76.05)


def records() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Restaurant_latitude": [11.0, 11.0, 12.0, None],
            "Restaurant_longitude": [76.0, 76.0, 77.0, None],
            "Delivery_location_latitude": [11.05, 11.05, 12.05, 0.08],
            "Delivery_location_longitude": [76.05, 76.05, 77.05, 0.08],
            "distance_km": [7.7, 7.7, 7.6, None],
        }
    ).astype({"distance_km": "Float64"})


def osrm_payload(routes_data, snap=10):
    return {"code": "Ok", "routes": routes_data, "waypoints": [{"distance": 5}, {"distance": snap}]}


def osrm_route(metres, seconds, mode="driving"):
    return {"distance": metres, "duration": seconds, "legs": [{"steps": [{"mode": mode}]}]}


def serve(monkeypatch, payload):
    class Response(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

    monkeypatch.setattr(
        routes.urllib.request, "urlopen", lambda *_, **__: Response(json.dumps(payload).encode())
    )


def test_each_unique_route_is_requested_once() -> None:
    calls = []

    def fetch(pair):
        calls.append(pair)
        return (10.0, 20.0)

    enriched, summary = enrich_records(records(), fetch, {})

    assert len(calls) == summary.unique_routes == 2
    assert summary.routed_rows == 3
    assert enriched["road_distance_km"].iloc[0] == 10.0
    assert enriched["route_duration_minutes"].iloc[1] == 20.0


def test_rows_without_valid_coordinates_keep_null_routes() -> None:
    enriched, summary = enrich_records(records(), lambda _: (10.0, 20.0), {})

    assert summary.usable_rows == 3
    assert pd.isna(enriched["road_distance_km"].iloc[3])


def test_unroutable_pairs_stay_null_and_are_cached() -> None:
    cache: dict = {}

    enriched, summary = enrich_records(records(), lambda _: None, cache)

    assert summary.routed_rows == 0
    assert enriched["road_distance_km"].isna().all()
    assert all(value is None for value in cache.values())


def test_cached_routes_are_not_requested_again() -> None:
    cache: dict = {}
    enrich_records(records(), lambda _: (10.0, 20.0), cache)

    def fail(_):
        raise AssertionError("A cached route was requested.")

    _, summary = enrich_records(records(), fail, cache)

    assert summary.routed_rows == 3


def test_failed_requests_are_retried_on_the_next_run() -> None:
    cache: dict = {}

    def fail(_):
        raise RouteServiceError("down")

    _, summary = enrich_records(records(), fail, cache)

    assert summary.failed_routes == 2
    assert cache == {}


def test_repeated_failures_stop_the_run() -> None:
    frame = pd.DataFrame(
        {
            "Restaurant_latitude": [float(i) + 1 for i in range(8)],
            "Restaurant_longitude": [76.0] * 8,
            "Delivery_location_latitude": [float(i) + 1.05 for i in range(8)],
            "Delivery_location_longitude": [76.05] * 8,
            "distance_km": [7.0] * 8,
        }
    )
    calls = []

    def fail(pair):
        calls.append(pair)
        raise RouteServiceError("down")

    with pytest.raises(RouteServiceError):
        enrich_records(frame, fail, {})
    assert len(calls) == routes.MAX_CONSECUTIVE_FAILURES


def test_fetch_route_returns_road_kilometers_and_minutes(monkeypatch) -> None:
    serve(monkeypatch, osrm_payload([osrm_route(12_500, 900)]))

    assert fetch_route("http://osrm", PAIR, 500) == (12.5, 15.0)


def test_fetch_route_prefers_a_route_without_a_ferry(monkeypatch) -> None:
    serve(monkeypatch, osrm_payload([osrm_route(3_000, 1_400, "ferry"), osrm_route(7_000, 720)]))

    assert fetch_route("http://osrm", PAIR, 500) == (7.0, 12.0)


def test_fetch_route_rejects_a_point_far_from_any_road(monkeypatch) -> None:
    serve(monkeypatch, osrm_payload([osrm_route(5_000, 300)], snap=900))

    assert fetch_route("http://osrm", PAIR, 500) is None
