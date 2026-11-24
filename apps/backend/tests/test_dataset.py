"""Tests for the dataset table endpoints."""

from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.dataset import DatasetTables


@pytest.fixture()
def dataset_client(tmp_path: Path) -> TestClient:
    cleaned = pd.DataFrame({
        "ID": ["0xa1", "0xb2", "0xc3", "0xd4"],
        "City": pd.array(["Metropolitan", "Urban", None, "Urban"], dtype="string"),
        "Type_of_order": ["meal", "snack", "meal", "drinks"],
        "Festival": ["no", "yes", "no", "no"],
        "Weather_conditions": pd.array(["fog", "sunny", "fog", None], dtype="string"),
        "order_timestamp": pd.to_datetime(
            ["2022-03-01 08:10", "2022-03-02 12:00", "2022-03-03 19:30", "2022-03-04 22:05"]
        ),
        "road_distance_km": pd.array([4.5, None, 12.25, 2.0], dtype="Float64"),
        "delivery_time_minutes": pd.array([20.0, 31.0, 44.0, 18.0], dtype="Float64"),
        "long_delivery_review": pd.array([False, False, False, False], dtype="boolean"),
    })
    parquet = tmp_path / "dataset_with_routes.parquet"
    cleaned.to_parquet(parquet, index=False)
    raw = tmp_path / "raw.csv"
    raw.write_text(
        "ID,City,Time_taken (min)\n0xa1,Metropolitian ,9\n0xb2,NaN ,10\n0xc3,Urban ,100\n",
        encoding="utf-8",
    )
    application = create_app()
    application.state.datasets = DatasetTables([parquet], raw)
    return TestClient(application)


def test_first_page_describes_columns_and_counts(dataset_client: TestClient) -> None:
    body = dataset_client.get("/api/dataset", params={"page_size": 2}).json()

    assert body["source"] == "cleaned"
    assert body["source_file"] == "dataset_with_routes.parquet"
    assert (body["total_rows"], body["matched_rows"], body["page_count"]) == (4, 4, 2)
    assert [row[0] for row in body["rows"]] == ["0xa1", "0xb2"]
    columns = {column["name"]: column for column in body["columns"]}
    assert columns["road_distance_km"]["type"] == "number"
    assert columns["road_distance_km"]["model_input"] is True
    assert columns["Weather_conditions"]["model_input"] is False
    assert "isn't known" in columns["Weather_conditions"]["description"]
    assert columns["order_timestamp"]["type"] == "datetime"
    assert columns["long_delivery_review"]["type"] == "boolean"
    assert body["rows"][0][5] == "2022-03-01 08:10"
    assert body["rows"][1][6] is None
    assert body["filters"]["city"] == ["Metropolitan", "Urban"]


def test_filters_and_search_narrow_the_rows(dataset_client: TestClient) -> None:
    urban = dataset_client.get("/api/dataset", params={"city": "Urban"}).json()
    searched = dataset_client.get("/api/dataset", params={"search": "SNACK"}).json()
    combined = dataset_client.get(
        "/api/dataset", params={"city": "Urban", "weather": "sunny", "festival": "yes"}
    ).json()

    assert [row[0] for row in urban["rows"]] == ["0xb2", "0xd4"]
    assert [row[0] for row in searched["rows"]] == ["0xb2"]
    assert combined["matched_rows"] == 1


def test_sorting_keeps_empty_values_last(dataset_client: TestClient) -> None:
    ascending = dataset_client.get("/api/dataset", params={"sort": "road_distance_km"}).json()
    descending = dataset_client.get(
        "/api/dataset", params={"sort": "road_distance_km", "order": "desc"}
    ).json()

    assert [row[0] for row in ascending["rows"]] == ["0xd4", "0xa1", "0xc3", "0xb2"]
    assert [row[0] for row in descending["rows"]] == ["0xc3", "0xa1", "0xd4", "0xb2"]


def test_raw_source_is_unchanged_text_with_numeric_sorting(dataset_client: TestClient) -> None:
    body = dataset_client.get(
        "/api/dataset", params={"source": "raw", "sort": "Time_taken (min)", "order": "desc"}
    ).json()

    assert body["source"] == "raw"
    assert [row[2] for row in body["rows"]] == ["100", "10", "9"]
    assert body["rows"][0][1] == "Urban "
    assert body["filters"]["city"] == ["Metropolitian ", "NaN ", "Urban "]


def test_page_past_the_end_returns_the_last_page(dataset_client: TestClient) -> None:
    body = dataset_client.get("/api/dataset", params={"page": 9, "page_size": 3}).json()

    assert body["page"] == 2
    assert [row[0] for row in body["rows"]] == ["0xd4"]


@pytest.mark.parametrize(
    "params",
    [{"sort": "missing_column"}, {"page_size": 500}, {"page": 0}, {"source": "other"}, {"order": "up"}],
)
def test_invalid_queries_are_rejected(dataset_client: TestClient, params: dict) -> None:
    assert dataset_client.get("/api/dataset", params=params).status_code == 422


def test_download_returns_the_filtered_rows_as_csv(dataset_client: TestClient) -> None:
    response = dataset_client.get("/api/dataset/download", params={"city": "Urban"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "delivery-dataset-cleaned.csv" in response.headers["content-disposition"]
    lines = response.text.strip().splitlines()
    assert lines[0].startswith("ID,City,")
    assert [line.split(",")[0] for line in lines[1:]] == ["0xb2", "0xd4"]


def test_missing_dataset_returns_503(tmp_path: Path) -> None:
    application = create_app()
    application.state.datasets = DatasetTables([tmp_path / "missing.parquet"], None)
    response = TestClient(application).get("/api/dataset")

    assert response.status_code == 503
    assert "isn't available" in response.json()["detail"]
