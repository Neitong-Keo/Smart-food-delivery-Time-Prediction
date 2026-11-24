"""Browse the delivery dataset a page at a time."""

from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from app.api.dependencies import get_dataset_tables
from app.schemas.dataset import DatasetColumn, DatasetPageResponse
from app.services.dataset import (
    DatasetQuery,
    DatasetSource,
    DatasetTables,
    DatasetUnavailableError,
    SortOrder,
    UnknownColumnError,
)

router = APIRouter(prefix="/api/dataset", tags=["dataset"])

Tables = Annotated[DatasetTables, Depends(get_dataset_tables)]
FilterValue = Annotated[str | None, Query(max_length=60)]


def _query(
    source: DatasetSource = "cleaned",
    sort: Annotated[str | None, Query(max_length=60)] = None,
    order: SortOrder = "asc",
    search: Annotated[str | None, Query(max_length=100)] = None,
    city: FilterValue = None,
    type_of_order: FilterValue = None,
    festival: FilterValue = None,
    weather: FilterValue = None,
) -> DatasetQuery:
    filters = {"city": city, "type_of_order": type_of_order, "festival": festival, "weather": weather}
    return DatasetQuery(
        source=source,
        sort=sort or None,
        order=order,
        search=search,
        filters={key: value for key, value in filters.items() if value},
    )


Query_ = Annotated[DatasetQuery, Depends(_query)]


def _unavailable(error: Exception) -> HTTPException:
    if isinstance(error, UnknownColumnError):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error))
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error))


@router.get("", response_model=DatasetPageResponse)
def get_dataset_page(
    tables: Tables,
    query: Query_,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> DatasetPageResponse:
    """Return one page of the cleaned or raw dataset."""
    try:
        result = tables.page(query, page, page_size)
    except (DatasetUnavailableError, UnknownColumnError) as error:
        raise _unavailable(error) from error
    return DatasetPageResponse(
        source=result.source,
        source_file=result.source_file,
        total_rows=result.total_rows,
        matched_rows=result.matched_rows,
        page=result.page,
        page_size=result.page_size,
        page_count=result.page_count,
        sort=result.sort,
        order=result.order,
        columns=[DatasetColumn(**asdict(column)) for column in result.columns],
        rows=result.rows,
        filters=result.filter_options,
    )


@router.get("/download", response_class=Response)
def download_dataset(tables: Tables, query: Query_) -> Response:
    """Download every row that matches the current search and filters as CSV."""
    try:
        text, filename = tables.to_csv(query)
    except (DatasetUnavailableError, UnknownColumnError) as error:
        raise _unavailable(error) from error
    return Response(
        content=text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
