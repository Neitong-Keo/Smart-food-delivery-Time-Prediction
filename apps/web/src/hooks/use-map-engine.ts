"use client";

import { useEffect, useState } from "react";

import { MapUnavailableError, prepareMap, type MapFailure } from "@/services/maps/map.service";

export type MapEngineState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "unavailable"; reason: MapFailure };

export function useMapEngine(): MapEngineState {
  const [state, setState] = useState<MapEngineState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    prepareMap()
      .then(() => {
        if (active) setState({ status: "ready" });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: "unavailable",
            reason: error instanceof MapUnavailableError ? error.reason : "load",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
