import { Notice } from "@/components/ui/Notice";
import type { MapEngineState } from "@/hooks/use-map-engine";

export function MapStatusNotice({ engine }: { engine: MapEngineState }) {
  if (engine.status !== "unavailable") return null;
  return (
    <Notice
      tone="warning"
      title={engine.reason === "webgl" ? "This browser can't display the map" : "The map couldn't load"}
    >
      You can still search for an address or choose a sample area.
    </Notice>
  );
}
