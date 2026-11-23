import type { NewPredictionHistoryEntry, PredictionHistoryEntry } from "@/types/prediction";

/**
 * Prediction history storage. Methods are async so a backend implementation
 * (GET /api/predictions) can replace local storage without changing callers.
 */
export interface PredictionHistoryRepository {
  list(): Promise<PredictionHistoryEntry[]>;
  add(entry: NewPredictionHistoryEntry): Promise<PredictionHistoryEntry>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

const STORAGE_KEY = "smart-delivery-history-v1";
const MAX_ENTRIES = 100;

function isHistoryEntry(value: unknown): value is PredictionHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<PredictionHistoryEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.createdAt === "string" &&
    !Number.isNaN(Date.parse(entry.createdAt)) &&
    typeof entry.restaurantName === "string" &&
    typeof entry.destination === "string" &&
    typeof entry.distanceKm === "number" &&
    typeof entry.predictedMinutes === "number" &&
    (entry.modelStatus === "demo" || entry.modelStatus === "live")
  );
}

class LocalStorageHistoryRepository implements PredictionHistoryRepository {
  private read(): PredictionHistoryEntry[] {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter(isHistoryEntry) : [];
    } catch {
      return [];
    }
  }

  private write(entries: PredictionHistoryEntry[]): void {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  async list(): Promise<PredictionHistoryEntry[]> {
    return this.read();
  }

  async add(entry: NewPredictionHistoryEntry): Promise<PredictionHistoryEntry> {
    const saved: PredictionHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.write([saved, ...this.read()].slice(0, MAX_ENTRIES));
    return saved;
  }

  async remove(id: string): Promise<void> {
    this.write(this.read().filter((entry) => entry.id !== id));
  }

  async clear(): Promise<void> {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export const historyRepository: PredictionHistoryRepository = new LocalStorageHistoryRepository();
