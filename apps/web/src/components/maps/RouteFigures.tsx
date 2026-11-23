import type { RouteStatus } from "@/hooks/use-delivery-route";
import { formatKm, formatMinutes } from "@/lib/format";
import type { RouteSummary } from "@/types/location";

export function RouteFigures({ route, status }: { route: RouteSummary | null; status: RouteStatus }) {
  if (status === "idle" || status === "error") return null;
  if (status === "loading" || !route) {
    return (
      <div className="route-figures" role="status" aria-label="Calculating route">
        <div className="skeleton" style={{ height: "3.25rem" }} />
        <div className="skeleton" style={{ height: "3.25rem" }} />
      </div>
    );
  }

  return (
    <dl className="route-figures">
      <div className="route-figure">
        <dt>Road distance</dt>
        <dd>{formatKm(route.distanceKm)}</dd>
      </div>
      <div className="route-figure">
        <dt>Estimated drive time</dt>
        <dd>{formatMinutes(route.durationMinutes)}</dd>
      </div>
    </dl>
  );
}
