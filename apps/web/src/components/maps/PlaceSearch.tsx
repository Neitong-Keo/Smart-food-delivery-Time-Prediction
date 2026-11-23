"use client";

import { Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatSuggestion, searchPlaces } from "@/services/maps/geocoding.service";
import type { DeliveryLocation, LatLng, PlaceSuggestion } from "@/types/location";

const MIN_QUERY_LENGTH = 3;
const SEARCH_DELAY_MS = 350;

interface PlaceSearchProps {
  near: LatLng;
  onSelect: (location: DeliveryLocation) => void;
  onError: (message: string) => void;
}

export function PlaceSearch({ near, onSelect, onError }: PlaceSearchProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const skipSearchFor = useRef<string | null>(null);
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DELAY_MS);
  const nearLat = near.lat;
  const nearLng = near.lng;

  useEffect(() => {
    if (skipSearchFor.current === debouncedQuery) return;
    skipSearchFor.current = null;
    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    searchPlaces(debouncedQuery, { lat: nearLat, lng: nearLng }, controller.signal)
      .then((results) => {
        if (controller.signal.aborted) return;
        setSuggestions(results);
        setHasSearched(true);
        setActiveIndex(results.length ? 0 : -1);
        setIsOpen(true);
        setIsLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
        onError("Address search isn't available right now. Click the map to set your location.");
      });

    return () => controller.abort();
  }, [debouncedQuery, nearLat, nearLng, onError]);

  const choose = (suggestion: PlaceSuggestion) => {
    const address = formatSuggestion(suggestion);
    skipSearchFor.current = address.trim();
    setQuery(address);
    setSuggestions([]);
    setHasSearched(false);
    setIsOpen(false);
    onSelect({ lat: suggestion.lat, lng: suggestion.lng, address, source: "search" });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (!isOpen || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
    }
  };

  const showList = isOpen && (suggestions.length > 0 || hasSearched);

  return (
    <div className="field place-search">
      <label htmlFor="delivery-search" className="field-label">
        Delivery address
      </label>
      <div className="input-with-icon">
        <Search className="input-icon" size={18} aria-hidden />
        <input
          id="delivery-search"
          className="input"
          type="text"
          role="combobox"
          placeholder="Search for your address"
          autoComplete="off"
          maxLength={120}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={onKeyDown}
        />
        {isLoading ? (
          <span className="input-clear" aria-hidden="true">
            <Loader2 className="spin" size={16} />
          </span>
        ) : (
          query && (
            <button
              type="button"
              className="input-clear"
              aria-label="Clear address search"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setHasSearched(false);
              }}
            >
              <X size={16} aria-hidden />
            </button>
          )
        )}
      </div>

      {showList && (
        <ul id={listId} className="place-options" role="listbox" aria-label="Address suggestions">
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.id}-${index}`}
              id={`${listId}-${index}`}
              className="place-option"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(suggestion)}
            >
              <MapPin size={15} aria-hidden />
              <span>
                <span className="place-option-primary">{suggestion.primary}</span>
                {suggestion.secondary && (
                  <span className="place-option-secondary" style={{ display: "block" }}>
                    {suggestion.secondary}
                  </span>
                )}
              </span>
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="place-message" role="presentation">
              No addresses found nearby. Try another search, or click the map.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
