/**
 * Order times chosen in the demo, in the restaurant's local time.
 *
 * The model uses only the hour and the day of the week (Monday = 0), so the demo
 * asks for a weekday and a clock time and places the order on the next such day.
 * Requests carry the restaurant's own UTC offset (for example +05:30), so a viewer
 * in another time zone gets the same hour the restaurant would see.
 */

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** Hours the model saw in training: 8 AM to midnight, plus the midnight hour itself. */
export const TRAINING_HOURS_LABEL = "8 AM to midnight";

export interface OrderTime {
  /** Monday = 0 to Sunday = 6, matching the model's order_day_of_week. */
  dayOfWeek: number;
  /** 24-hour "HH:MM". */
  time: string;
}

const ZONED_ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?([+-]\d{2}:\d{2})$/;

const pad = (value: number) => String(Math.trunc(Math.abs(value))).padStart(2, "0");

export function isZonedIsoString(value: string): boolean {
  return ZONED_ISO.test(value);
}

/** Wall-clock parts of an instant in a time zone, or in the browser's zone when none is given. */
export function zonedParts(date: Date, timeZone?: string | null) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone ?? undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  return {
    year,
    month,
    day,
    hour: get("hour") % 24,
    minute: get("minute"),
    dayOfWeek: (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7,
  };
}

/** The zone's UTC offset at an instant, as "+05:30". */
export function zoneOffset(at: Date, timeZone?: string | null): string {
  if (timeZone) {
    try {
      const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
        .formatToParts(at)
        .find((part) => part.type === "timeZoneName")?.value;
      if (name === "GMT") return "+00:00";
      const match = name && /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
      if (match) return `${match[1]}${pad(Number(match[2]))}:${match[3] ?? "00"}`;
    } catch {
      // Fall through to the browser's offset.
    }
  }
  const offset = -at.getTimezoneOffset();
  return `${offset >= 0 ? "+" : "-"}${pad(offset / 60)}:${pad(offset % 60)}`;
}

/** ISO 8601 for the next `dayOfWeek` at `time` in the restaurant's zone (today counts). */
export function buildZonedIso({ dayOfWeek, time }: OrderTime, timeZone?: string | null, now = new Date()): string {
  const today = zonedParts(now, timeZone);
  const [hour, minute] = time.split(":").map(Number);
  const ahead = (dayOfWeek - today.dayOfWeek + 7) % 7;
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day + ahead, hour, minute));
  // Treating the wall time as UTC is close enough to find the offset outside DST changes.
  const offset = zoneOffset(date, timeZone);
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `T${pad(hour)}:${pad(minute)}:00${offset}`
  );
}

/** Read the weekday and clock time back out of a value from buildZonedIso. */
export function parseZonedIso(value: string | null): OrderTime | null {
  const match = value ? ZONED_ISO.exec(value) : null;
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const weekday = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay();
  return { dayOfWeek: (weekday + 6) % 7, time: `${hour}:${minute}` };
}

/** The current weekday and time at the restaurant. */
export function currentOrderTime(timeZone?: string | null, now = new Date()): OrderTime {
  const parts = zonedParts(now, timeZone);
  return { dayOfWeek: parts.dayOfWeek, time: `${pad(parts.hour)}:${pad(parts.minute)}` };
}

export function formatOrderTimeOfDay(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${pad(minute)} ${hour < 12 ? "AM" : "PM"}`;
}

/** Whether the model saw orders at this hour. The API warns outside these hours too. */
export function isTrainingHour(time: string): boolean {
  const hour = Number(time.split(":")[0]);
  return hour === 0 || hour >= 8;
}
