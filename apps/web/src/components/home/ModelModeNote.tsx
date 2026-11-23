"use client";

import { useModelInfo } from "@/hooks/use-model-info";

/** Only claim demo results while the backend is actually serving them. */
export function ModelModeNote() {
  const { info } = useModelInfo();

  return (
    <p className="home-demo-note">
      {info && info.model_status !== "live"
        ? "Times are demo results based on road distance until the trained model is connected."
        : " "}
    </p>
  );
}
