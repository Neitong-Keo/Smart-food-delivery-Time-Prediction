"""Page through the delivery dataset for the technical report's table.

The cleaned table is the route-enriched Parquet when it exists, otherwise the
cleaned Parquet. The raw table is the source CSV exactly as downloaded, read as text.
Each file is read once, on first use, and kept in memory.
"""

import json
import math
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd

from ml.manifest import resolve_dataset_paths

DatasetSource = Literal["cleaned", "raw"]
SortOrder = Literal["asc", "desc"]
ColumnType = Literal["text", "number", "datetime", "boolean"]
Cell = str | int | float | bool | None

# Query parameter -> column, for the filters offered above the table.
FILTER_COLUMNS = {
    "city": "City",
    "type_of_order": "Type_of_order",
    "festival": "Festival",
    "weather": "Weather_conditions",
}
MODEL_INPUTS = frozenset(
    {"Type_of_order", "Festival", "City", "order_hour", "order_day_of_week", "road_distance_km"}
)
RAW_NUMERIC_COLUMNS = frozenset(
    {
        "Delivery_person_Age",
        "Delivery_person_Ratings",
        "Restaurant_latitude",
        "Restaurant_longitude",
        "Delivery_location_latitude",
        "Delivery_location_longitude",
        "Vehicle_condition",
        "multiple_deliveries",
        "Time_taken (min)",
    }
)
NOT_KNOWN_AT_ORDER = "Not a model input: it isn't known when the order is placed."
COLUMN_DESCRIPTIONS = {
    "ID": "Order ID.",
    "Delivery_person_ID": "Rider ID. " + NOT_KNOWN_AT_ORDER,
    "order_id_conflict": "True when another order has the same ID.",
    "Weather_conditions": "Weather during the delivery. " + NOT_KNOWN_AT_ORDER,
    "Road_traffic_density": "Traffic during the delivery. " + NOT_KNOWN_AT_ORDER,
    "Type_of_order": "Model input. Snack, meal, drinks or buffet.",
    "Type_of_vehicle": "Rider's vehicle. " + NOT_KNOWN_AT_ORDER,
    "Festival": "Model input. Whether the order was placed during a festival.",
    "City": "Model input. Metropolitan, urban or semi-urban area.",
    "Delivery_person_Age": "Rider age. " + NOT_KNOWN_AT_ORDER,
    "Delivery_person_Ratings": "Rider rating from 1 to 5. Ratings above 5 were cleared. "
    + NOT_KNOWN_AT_ORDER,
    "Vehicle_condition": "Vehicle condition score from 0 to 3. " + NOT_KNOWN_AT_ORDER,
    "multiple_deliveries": "Other orders the rider carried on the same trip. " + NOT_KNOWN_AT_ORDER,
    "order_timestamp": "When the order was placed, in local time.",
    "order_hour": "Model input. Hour the order was placed, 0 to 23.",
    "order_day_of_week": "Model input. Day of the week, Monday = 0 to Sunday = 6.",
    "Restaurant_latitude": "Restaurant latitude. (0, 0) locations were cleared.",
    "Restaurant_longitude": "Restaurant longitude. (0, 0) locations were cleared.",
    "Delivery_location_latitude": "Customer latitude.",
    "Delivery_location_longitude": "Customer longitude.",
    "distance_km": "Straight-line distance in km. Replaced by road distance in the model.",
    "delivery_time_minutes": "Target. Minutes from order to delivery.",
    "long_delivery_review": "True when the delivery took over 60 minutes.",
    "road_distance_km": "Model input. Distance along the road from OSRM, in km.",
    "route_duration_minutes": "OSRM drive time without traffic. Shown for reference only.",
    "Order_Date": "Order date, DD-MM-YYYY.",
    "Time_Orderd": "Order time, HH:MM or a fraction of a day.",
    "Time_Order_picked": "Pickup time. Excluded because it happens after the order.",
    "Time_taken (min)": "Target. Minutes from order to delivery.",
}


class DatasetUnavailableError(RuntimeError):
    """The requested dataset file isn't on this server."""


class UnknownColumnError(ValueError):
    """The sort column isn't in the dataset."""


@dataclass(frozen=True)
class DatasetColumnInfo:
    name: str
    type: ColumnType
    description: str | None
    model_input: bool


@dataclass(frozen=True)
class LoadedTable:
    """One dataset in memory, with precomputed search text and sort keys."""

    source: DatasetSource
    file: Path
    frame: pd.DataFrame
    columns: tuple[DatasetColumnInfo, ...]
    search_text: pd.Series
    filter_options: dict[str, list[str]]


@dataclass(frozen=True)
class DatasetQuery:
    source: DatasetSource = "cleaned"
    sort: str | None = None
    order: SortOrder = "asc"
    search: str | None = None
    filters: dict[str, str] | None = None


@dataclass(frozen=True)
class DatasetPage:
    source: DatasetSource
    source_file: str
    total_rows: int
    matched_rows: int
    page: int
    page_size: int
    page_count: int
    sort: str | None
    order: SortOrder
    columns: tuple[DatasetColumnInfo, ...]
    rows: list[list[Cell]]
    filter_options: dict[str, list[str]]


def _column_type(source: DatasetSource, name: str, values: pd.Series) -> ColumnType:
    if source == "raw":
        return "number" if name in RAW_NUMERIC_COLUMNS else "text"
    if pd.api.types.is_bool_dtype(values):
        return "boolean"
    if pd.api.types.is_datetime64_any_dtype(values):
        return "datetime"
    if pd.api.types.is_numeric_dtype(values):
        return "number"
    return "text"


def _cell(value: Any) -> Cell:
    if value is None or value is pd.NA or value is pd.NaT:
        return None
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        return None if math.isnan(value) else round(float(value), 6)
    return str(value)


class DatasetTables:
    """Lazy, cached access to the cleaned and raw dataset files."""

    def __init__(self, cleaned_paths: list[Path], raw_path: Path | None) -> None:
        self._paths: dict[DatasetSource, list[Path]] = {
            "cleaned": cleaned_paths,
            "raw": [raw_path] if raw_path else [],
        }
        self._tables: dict[DatasetSource, LoadedTable] = {}
        self._lock = threading.Lock()

    @classmethod
    def from_config(cls) -> "DatasetTables":
        paths = resolve_dataset_paths()
        raw_path = paths.raw_csv
        try:
            report = json.loads(paths.dataset_manifest.read_text(encoding="utf-8"))
            if isinstance(report, dict) and report.get("source_file"):
                raw_path = paths.raw_csv.parent / str(report["source_file"])
        except (OSError, ValueError):
            pass
        return cls([paths.routed_parquet, paths.processed_parquet], raw_path)

    def table(self, source: DatasetSource) -> LoadedTable:
        with self._lock:
            if source not in self._tables:
                self._tables[source] = self._load(source)
            return self._tables[source]

    def _load(self, source: DatasetSource) -> LoadedTable:
        file = next((path for path in self._paths[source] if path.is_file()), None)
        if file is None:
            command = (
                "python -m ml.scripts.ingest" if source == "cleaned" else "the Kaggle download"
            )
            raise DatasetUnavailableError(
                f"The {source} dataset isn't available on this server. Prepare it with {command}."
            )
        if source == "raw":
            frame = pd.read_csv(file, dtype="string", keep_default_na=False, encoding="utf-8-sig")
            frame.columns = [str(column).strip() for column in frame.columns]
        else:
            frame = pd.read_parquet(file)
        frame = frame.reset_index(drop=True)

        columns = tuple(
            DatasetColumnInfo(
                name=str(name),
                type=_column_type(source, str(name), frame[name]),
                description=COLUMN_DESCRIPTIONS.get(str(name)),
                model_input=str(name) in MODEL_INPUTS,
            )
            for name in frame.columns
        )
        text_columns = [
            column.name for column in columns if column.type == "text" and column.name in frame
        ]
        search_text = pd.Series("", index=frame.index, dtype="string")
        if text_columns:
            parts = [frame[name].astype("string").fillna("") for name in text_columns]
            search_text = parts[0].str.cat(parts[1:], sep="|").str.casefold()

        filter_options = {
            key: sorted(str(value) for value in frame[column].dropna().unique())
            for key, column in FILTER_COLUMNS.items()
            if column in frame
        }
        return LoadedTable(source, file, frame, columns, search_text, filter_options)

    def _matching_index(self, table: LoadedTable, query: DatasetQuery) -> np.ndarray:
        frame = table.frame
        mask = pd.Series(True, index=frame.index)
        for key, value in (query.filters or {}).items():
            column = FILTER_COLUMNS.get(key)
            if value and column in frame:
                mask &= frame[column].astype("string").eq(value).fillna(False)
        if query.search and query.search.strip():
            needle = query.search.strip().casefold()
            mask &= table.search_text.str.contains(needle, regex=False).fillna(False)

        index = np.flatnonzero(mask.to_numpy(dtype=bool))
        if not query.sort:
            return index
        if query.sort not in frame:
            raise UnknownColumnError(f"Unknown column '{query.sort}'.")

        values = frame[query.sort].iloc[index]
        column = next(column for column in table.columns if column.name == query.sort)
        if table.source == "raw" and column.type == "number":
            values = pd.to_numeric(values, errors="coerce")
        # A stable sort with empty values last, in either direction.
        order = values.sort_values(
            ascending=query.order == "asc", na_position="last", kind="stable"
        ).index
        return order.to_numpy()

    def page(self, query: DatasetQuery, page: int, page_size: int) -> DatasetPage:
        table = self.table(query.source)
        index = self._matching_index(table, query)
        page_count = max(1, math.ceil(len(index) / page_size))
        page = min(page, page_count)
        selected = index[(page - 1) * page_size : page * page_size]
        rows = [
            [_cell(value) for value in row]
            for row in table.frame.iloc[selected].itertuples(index=False, name=None)
        ]
        return DatasetPage(
            source=table.source,
            source_file=table.file.name,
            total_rows=len(table.frame),
            matched_rows=len(index),
            page=page,
            page_size=page_size,
            page_count=page_count,
            sort=query.sort,
            order=query.order,
            columns=table.columns,
            rows=rows,
            filter_options=table.filter_options,
        )

    def to_csv(self, query: DatasetQuery) -> tuple[str, str]:
        """Return the matching rows as CSV text and a download file name."""
        table = self.table(query.source)
        frame = table.frame.iloc[self._matching_index(table, query)]
        return frame.to_csv(index=False), f"delivery-dataset-{query.source}.csv"
