import { config } from "@/lib/config";

export type ApiErrorKind =
  | "network"
  | "timeout"
  | "not_found"
  | "validation"
  | "unavailable"
  | "server"
  | "invalid_response";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions<T> {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  parse: (payload: unknown) => T;
}

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

export function getErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Try again.";
}

function readDetail(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("detail" in payload)) return null;
  const { detail } = payload;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") {
    return detail[0].msg.replace(/^Value error, /, "");
  }
  return null;
}

function errorFromResponse(status: number, payload: unknown): ApiError {
  const detail = readDetail(payload);
  if (status === 404) return new ApiError("not_found", detail ?? "Not found.", status);
  if (status === 422) {
    return new ApiError("validation", detail ?? "Check the delivery details and try again.", status);
  }
  if (status === 503) {
    return new ApiError("unavailable", detail ?? "The service is unavailable. Try again shortly.", status);
  }
  return new ApiError("server", `The delivery service returned an error (HTTP ${status}). Try again.`, status);
}

export async function apiRequest<T>(path: string, options: RequestOptions<T>): Promise<T> {
  const { method = "GET", body, signal, timeoutMs = config.apiTimeoutMs, parse } = options;
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });

  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      cache: "no-store",
      signal: controller.signal,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw errorFromResponse(response.status, payload);

    try {
      return parse(payload);
    } catch {
      throw new ApiError("invalid_response", "The delivery service sent an unexpected response.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) {
      throw new ApiError("timeout", "The delivery service took too long to respond. Try again.");
    }
    if (isAbortError(error)) throw error;
    throw new ApiError(
      "network",
      `The delivery service can't be reached at ${config.apiBaseUrl}. Check that the API is running, then try again.`,
    );
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", forwardAbort);
  }
}
