"""Tests for the restaurant catalog endpoints."""

from fastapi.testclient import TestClient

from app.main import create_app


client = TestClient(create_app())


def test_lists_restaurants_with_coordinates_and_filters() -> None:
    response = client.get("/api/restaurants")

    assert response.status_code == 200
    body = response.json()
    assert body["data_source"] == "sample"
    assert body["total"] == len(body["items"]) > 0
    assert "Indian" in body["cuisines"]
    assert all(item["address"].endswith("Bengaluru, India") for item in body["items"])
    assert all(item["time_zone"] == "Asia/Kolkata" for item in body["items"])
    assert len({item["id"] for item in body["items"]}) == body["total"]


def test_search_is_case_insensitive_and_keeps_all_cuisines() -> None:
    all_cuisines = client.get("/api/restaurants").json()["cuisines"]

    body = client.get("/api/restaurants", params={"search": "rAmEn"}).json()

    assert [item["name"] for item in body["items"]] == ["Hinoki Ramen"]
    assert body["cuisines"] == all_cuisines


def test_filters_by_cuisine() -> None:
    body = client.get("/api/restaurants", params={"cuisine": "japanese"}).json()

    assert body["total"] == 2
    assert {item["cuisine"] for item in body["items"]} == {"Japanese"}


def test_gets_one_restaurant() -> None:
    response = client.get("/api/restaurants/restaurant_001")

    assert response.status_code == 200
    restaurant = response.json()
    assert restaurant["name"] == "Brigade Grill"
    assert (restaurant["latitude"], restaurant["longitude"]) == (12.972532, 77.608179)


def test_unknown_restaurant_returns_404() -> None:
    assert client.get("/api/restaurants/missing").status_code == 404
