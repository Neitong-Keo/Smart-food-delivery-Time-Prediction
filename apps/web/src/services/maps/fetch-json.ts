import { config } from "@/lib/config";

/** GET or fail after the maps timeout. A caller's abort is rethrown as AbortError. */
export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.mapsTimeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}.`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", forwardAbort);
  }
}
