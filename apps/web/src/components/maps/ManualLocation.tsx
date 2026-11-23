"use client";

import { useState, type FormEvent } from "react";

import { DEMO_DELIVERY_AREAS } from "@/lib/demo-locations";
import type { LatLng, LocationSource } from "@/types/location";

interface ManualLocationProps {
  onPick: (point: LatLng, source: LocationSource, address?: string) => void;
}

/** Location entry used when the map cannot load. */
export function ManualLocation({ onPick }: ManualLocationProps) {
  const [areaId, setAreaId] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const chooseArea = (id: string) => {
    setAreaId(id);
    const area = DEMO_DELIVERY_AREAS.find((item) => item.id === id);
    if (area) onPick({ lat: area.lat, lng: area.lng }, "preset", area.name);
  };

  const submitCoordinates = (event: FormEvent) => {
    event.preventDefault();
    setAreaId("");
    onPick({ lat: Number(latitude || Number.NaN), lng: Number(longitude || Number.NaN) }, "coordinates");
  };

  return (
    <div className="manual-location">
      <div className="field">
        <label htmlFor="demo-area" className="field-label">
          Delivery area
        </label>
        <select
          id="demo-area"
          className="select-input"
          value={areaId}
          onChange={(event) => chooseArea(event.target.value)}
        >
          <option value="">Choose a sample area</option>
          {DEMO_DELIVERY_AREAS.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

      <details className="coordinate-details">
        <summary>Enter coordinates instead</summary>
        <form className="coordinate-form" onSubmit={submitCoordinates}>
          <div className="field">
            <label htmlFor="manual-lat" className="field-label">Latitude</label>
            <input
              id="manual-lat"
              className="input"
              inputMode="decimal"
              placeholder="12.992532"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="manual-lng" className="field-label">Longitude</label>
            <input
              id="manual-lng"
              className="input"
              inputMode="decimal"
              placeholder="77.628179"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
            />
          </div>
          <button type="submit" className="button button-secondary">
            Use these coordinates
          </button>
        </form>
      </details>
    </div>
  );
}
