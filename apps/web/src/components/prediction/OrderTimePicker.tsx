"use client";

import { useEffect, useId, useState } from "react";

import {
  TRAINING_HOURS_LABEL,
  WEEKDAYS,
  buildZonedIso,
  currentOrderTime,
  formatOrderTimeOfDay,
  parseZonedIso,
  zoneOffset,
  type OrderTime,
} from "@/lib/order-time";

interface OrderTimePickerProps {
  /** Restaurant-local ISO time, or null for "now". */
  value: string | null;
  timeZone?: string | null;
  onChange: (value: string | null) => void;
}

/** Choose when the order is placed. The model uses the hour and the day of the week. */
export function OrderTimePicker({ value, timeZone, onChange }: OrderTimePickerProps) {
  const id = useId();
  const chosen = parseZonedIso(value);
  const [now, setNow] = useState<OrderTime | null>(null);

  // Read the clock after hydration so the server and browser render the same markup.
  useEffect(() => {
    const update = () => setNow(currentOrderTime(timeZone));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [timeZone]);

  const shown = chosen ?? now;
  const offset = zoneOffset(new Date(), timeZone);
  const setTime = (next: OrderTime) => onChange(buildZonedIso(next, timeZone));

  return (
    <fieldset className="order-type-group order-time">
      <legend>Order time</legend>
      <div className="segmented segmented-2">
        <label className="segment">
          <input type="radio" name={`${id}-mode`} checked={!chosen} onChange={() => onChange(null)} />
          <span>Now</span>
        </label>
        <label className="segment">
          <input
            type="radio"
            name={`${id}-mode`}
            checked={Boolean(chosen)}
            onChange={() => setTime(now ?? currentOrderTime(timeZone))}
          />
          <span>Choose a time</span>
        </label>
      </div>

      {chosen ? (
        <div className="order-time-fields">
          <div className="field">
            <label htmlFor={`${id}-day`} className="field-label">
              Day
            </label>
            <select
              id={`${id}-day`}
              className="select-input"
              value={chosen.dayOfWeek}
              onChange={(event) => setTime({ ...chosen, dayOfWeek: Number(event.target.value) })}
            >
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-time`} className="field-label">
              Time
            </label>
            <input
              id={`${id}-time`}
              className="input"
              type="time"
              step={300}
              required
              value={chosen.time}
              onChange={(event) => {
                if (/^\d{2}:\d{2}$/.test(event.target.value)) setTime({ ...chosen, time: event.target.value });
              }}
            />
          </div>
        </div>
      ) : (
        <p className="order-time-now" aria-live="polite">
          {shown ? `${WEEKDAYS[shown.dayOfWeek]}, ${formatOrderTimeOfDay(shown.time)}` : " "}
        </p>
      )}

      <p className="field-hint">
        Restaurant time (UTC{offset}). The model learned from orders placed {TRAINING_HOURS_LABEL}.
      </p>
    </fieldset>
  );
}
