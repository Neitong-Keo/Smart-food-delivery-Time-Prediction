import { formatKm, formatMinutes, formatOrderTime } from "@/lib/format";
import type { RouteSummary } from "@/types/location";
import type { PredictionPreview } from "@/types/prediction";

const asNumber = (value: unknown) => (typeof value === "number" ? value : null);

interface PredictionInputsProps {
  preview: PredictionPreview | null;
  route: RouteSummary;
}

/** Show what reaches the model, using the values the backend will actually send. */
export function PredictionInputs({ preview, route }: PredictionInputsProps) {
  const input = preview?.model_input;
  const day = asNumber(input?.order_day_of_week);
  const hour = asNumber(input?.order_hour);
  const driveTimeIsInput = Boolean(input && "route_duration_minutes" in input);

  return (
    <dl className="inputs-list">
      <div>
        <dt>Road distance</dt>
        <dd>{formatKm(asNumber(input?.road_distance_km) ?? route.distanceKm)}</dd>
      </div>
      {day !== null && hour !== null && (
        <div>
          <dt>Model sees</dt>
          <dd>{formatOrderTime(day, hour)}</dd>
        </div>
      )}
      {typeof input?.City === "string" && (
        <div>
          <dt>City type</dt>
          <dd>{input.City}</dd>
        </div>
      )}
      <div>
        <dt>{driveTimeIsInput ? "Drive time" : "Drive time (not used)"}</dt>
        <dd>{formatMinutes(route.durationMinutes)}</dd>
      </div>
    </dl>
  );
}
