import { config } from "@/lib/config";
import { apiRequest } from "@/services/api/api-client";

export type DatasetSource = "cleaned" | "raw";
export type DatasetCell = string | number | boolean | null;

export interface DatasetColumn {
  name: string;
  type: "text" | "number" | "datetime" | "boolean";
  description: string | null;
  model_input: boolean;
}

/** Mirrors `DatasetPageResponse` in apps/backend/app/schemas/dataset.py. */
export interface DatasetPage {
  source: DatasetSource;
  source_file: string;
  total_rows: number;
  matched_rows: number;
  page: number;
  page_size: number;
  page_count: number;
  sort: string | null;
  order: "asc" | "desc";
  columns: DatasetColumn[];
  rows: DatasetCell[][];
  filters: Record<string, string[]>;
}

export interface DatasetQuery {
  source: DatasetSource;
  page: number;
  pageSize: number;
  sort: string | null;
  order: "asc" | "desc";
  search: string;
  filters: Record<string, string>;
}

function parseDatasetPage(value: unknown): DatasetPage {
  const page = value as DatasetPage;
  if (
    !page ||
    typeof page !== "object" ||
    !Array.isArray(page.columns) ||
    !Array.isArray(page.rows) ||
    typeof page.total_rows !== "number" ||
    typeof page.matched_rows !== "number"
  ) {
    throw new Error("Invalid dataset page.");
  }
  return { ...page, filters: page.filters ?? {} };
}

function queryString(query: DatasetQuery, paging: boolean): string {
  const params = new URLSearchParams({ source: query.source, order: query.order });
  if (paging) {
    params.set("page", String(query.page));
    params.set("page_size", String(query.pageSize));
  }
  if (query.sort) params.set("sort", query.sort);
  if (query.search.trim()) params.set("search", query.search.trim());
  for (const [key, value] of Object.entries(query.filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function getDatasetPage(query: DatasetQuery, signal?: AbortSignal): Promise<DatasetPage> {
  return apiRequest(`/api/dataset?${queryString(query, true)}`, {
    signal,
    timeoutMs: 20_000,
    parse: parseDatasetPage,
  });
}

/** A link that downloads every matching row as CSV. */
export function datasetDownloadUrl(query: DatasetQuery): string {
  return `${config.apiBaseUrl}/api/dataset/download?${queryString(query, false)}`;
}
