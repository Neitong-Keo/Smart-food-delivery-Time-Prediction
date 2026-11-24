"use client";

import { useId } from "react";

export interface ModelOption {
  id: string;
  name: string;
  /** Chosen in training for the lowest validation error. */
  selected: boolean;
  unavailable?: boolean;
}

interface ModelPickerProps {
  models: ModelOption[];
  value: string;
  onChange: (modelId: string) => void;
}

/** Segmented control for the model whose prediction is shown. */
export function ModelPicker({ models, value, onChange }: ModelPickerProps) {
  const id = useId();
  if (models.length < 2) return null;

  return (
    <fieldset className="order-type-group">
      <legend>Model</legend>
      <div className="segmented" style={{ gridTemplateColumns: `repeat(${models.length}, minmax(0, 1fr))` }}>
        {models.map((model) => (
          <label key={model.id} className="segment segment-stacked">
            <input
              type="radio"
              name={`${id}-model`}
              value={model.id}
              checked={value === model.id}
              disabled={model.unavailable}
              onChange={() => onChange(model.id)}
            />
            <span>
              {model.name}
              <small>{model.unavailable ? "Unavailable" : model.selected ? "Selected model" : " "}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
