"""Dataset table API contract."""

from typing import Literal

from pydantic import BaseModel

ColumnType = Literal["text", "number", "datetime", "boolean"]


class DatasetColumn(BaseModel):
    """One column of the dataset, described for readers of the table."""

    name: str
    type: ColumnType
    description: str | None = None
    model_input: bool = False


class DatasetPageResponse(BaseModel):
    """One page of the dataset after search, filters and sorting."""

    source: Literal["cleaned", "raw"]
    source_file: str
    total_rows: int
    matched_rows: int
    page: int
    page_size: int
    page_count: int
    sort: str | None
    order: Literal["asc", "desc"]
    columns: list[DatasetColumn]
    rows: list[list[str | int | float | bool | None]]
    filters: dict[str, list[str]]
