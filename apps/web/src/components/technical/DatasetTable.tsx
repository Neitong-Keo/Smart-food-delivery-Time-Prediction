"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Notice } from "@/components/ui/Notice";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getErrorMessage, isAbortError } from "@/services/api/api-client";
import {
  datasetDownloadUrl,
  getDatasetPage,
  type DatasetCell,
  type DatasetColumn,
  type DatasetPage,
  type DatasetQuery,
  type DatasetSource,
} from "@/services/api/dataset.service";

const FILTERS = [
  { key: "city", label: "City" },
  { key: "type_of_order", label: "Order type" },
  { key: "festival", label: "Festival" },
  { key: "weather", label: "Weather" },
] as const;
const PAGE_SIZES = [25, 50, 100, 200];

const INITIAL_QUERY: DatasetQuery = {
  source: "cleaned",
  page: 1,
  pageSize: 50,
  sort: null,
  order: "asc",
  search: "",
  filters: {},
};

function formatCell(value: DatasetCell, column: DatasetColumn): string {
  if (value === null) return "empty";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return column.name.toLowerCase().includes("latitude") || column.name.toLowerCase().includes("longitude")
      ? value.toFixed(6)
      : value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  return value;
}

/** The whole dataset, a page at a time: sort, search, filter and download. */
export function DatasetTable() {
  const [query, setQuery] = useState<DatasetQuery>(INITIAL_QUERY);
  const [searchText, setSearchText] = useState("");
  const search = useDebouncedValue(searchText, 350);
  const [page, setPage] = useState<DatasetPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setQuery((current) => (current.search === search ? current : { ...current, search, page: 1 }));
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    getDatasetPage(query, controller.signal)
      .then((result) => {
        setPage(result);
        setError(null);
        setIsLoading(false);
      })
      .catch((reason: unknown) => {
        if (isAbortError(reason)) return;
        setError(getErrorMessage(reason));
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [query, attempt]);

  const update = (changes: Partial<DatasetQuery>) => setQuery((current) => ({ ...current, page: 1, ...changes }));

  const toggleSort = (column: string) => {
    if (query.sort !== column) update({ sort: column, order: "asc" });
    else if (query.order === "asc") update({ order: "desc" });
    else update({ sort: null, order: "asc" });
  };

  const setSource = (source: DatasetSource) => {
    setSearchText("");
    setQuery({ ...INITIAL_QUERY, source, pageSize: query.pageSize });
  };

  const firstRow = page ? (page.page - 1) * page.page_size : 0;

  return (
    <div className="tech-section">
      <div className="dataset-controls">
        <fieldset className="order-type-group">
          <legend>Version</legend>
          <div className="segmented segmented-2" style={{ minWidth: "14rem" }}>
            {(["cleaned", "raw"] as const).map((source) => (
              <label key={source} className="segment">
                <input
                  type="radio"
                  name="dataset-source"
                  checked={query.source === source}
                  onChange={() => setSource(source)}
                />
                <span>{source === "cleaned" ? "Cleaned" : "Raw CSV"}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field dataset-search">
          <label htmlFor="dataset-search" className="field-label">
            Search
          </label>
          <div className="input-with-icon">
            <Search className="input-icon" size={16} aria-hidden />
            <input
              id="dataset-search"
              className="input"
              type="search"
              placeholder="Order ID, rider ID or any text value"
              value={searchText}
              maxLength={100}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
        </div>

        {FILTERS.map((filter) => (
          <div key={filter.key} className="field">
            <label htmlFor={`filter-${filter.key}`} className="field-label">
              {filter.label}
            </label>
            <select
              id={`filter-${filter.key}`}
              className="select-input"
              value={query.filters[filter.key] ?? ""}
              onChange={(event) => update({ filters: { ...query.filters, [filter.key]: event.target.value } })}
            >
              <option value="">All</option>
              {(page?.filters[filter.key] ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {error && (
        <Notice
          tone="error"
          title="The dataset couldn't be loaded"
          action={
            <button type="button" className="button button-secondary" onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </button>
          }
        >
          {error}
        </Notice>
      )}

      {page && (
        <>
          <div className="dataset-meta">
            <p role="status" aria-live="polite">
              {page.matched_rows === page.total_rows
                ? `${page.total_rows.toLocaleString("en-US")} rows`
                : `${page.matched_rows.toLocaleString("en-US")} of ${page.total_rows.toLocaleString("en-US")} rows match`}{" "}
              · {page.columns.length} columns · <code>{page.source_file}</code>
            </p>
            <a className="button button-secondary" href={datasetDownloadUrl(query)} download>
              <Download size={16} aria-hidden />
              Download CSV
            </a>
          </div>

          <div className="dataset-grid" aria-busy={isLoading}>
            <table className="dataset-table">
              <thead>
                <tr>
                  <th scope="col" className="row-number">
                    #
                  </th>
                  {page.columns.map((column) => {
                    const sorted = query.sort === column.name;
                    const Icon = sorted ? (query.order === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                    return (
                      <th
                        key={column.name}
                        scope="col"
                        className={`${column.type === "number" ? "is-numeric" : ""} ${column.model_input ? "is-model-input" : ""}`}
                        aria-sort={sorted ? (query.order === "asc" ? "ascending" : "descending") : "none"}
                        title={column.description ?? undefined}
                      >
                        <button type="button" className="sort-button" onClick={() => toggleSort(column.name)}>
                          {column.name}
                          <Icon className="sort-icon" size={13} aria-hidden />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row, rowIndex) => (
                  <tr key={firstRow + rowIndex}>
                    <th scope="row" className="row-number">
                      {(firstRow + rowIndex + 1).toLocaleString("en-US")}
                    </th>
                    {row.map((cell, cellIndex) => {
                      const column = page.columns[cellIndex];
                      return (
                        <td
                          key={column.name}
                          className={`${column.type === "number" ? "is-numeric" : ""} ${cell === null ? "is-empty" : ""}`}
                        >
                          {formatCell(cell, column)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="dataset-meta">
            <div className="pagination">
              <button
                type="button"
                className="button button-secondary icon-button"
                aria-label="Previous page"
                disabled={page.page <= 1 || isLoading}
                onClick={() => setQuery((current) => ({ ...current, page: page.page - 1 }))}
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <span>
                Page {page.page.toLocaleString("en-US")} of {page.page_count.toLocaleString("en-US")}
              </span>
              <button
                type="button"
                className="button button-secondary icon-button"
                aria-label="Next page"
                disabled={page.page >= page.page_count || isLoading}
                onClick={() => setQuery((current) => ({ ...current, page: page.page + 1 }))}
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
            <label className="pagination">
              Rows per page
              <select
                className="select-input"
                value={query.pageSize}
                onChange={(event) => update({ pageSize: Number(event.target.value) })}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <details className="figure-table">
            <summary>What each column means</summary>
            <dl className="column-guide">
              {page.columns.map((column) => (
                <div key={column.name}>
                  <dt>
                    {column.name}
                    {column.model_input && <span className="tag">Model input</span>}
                  </dt>
                  <dd>{column.description ?? "Source column."}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}

      {!page && !error && <div className="skeleton" role="status" aria-label="Loading the dataset" style={{ height: "24rem" }} />}
    </div>
  );
}
