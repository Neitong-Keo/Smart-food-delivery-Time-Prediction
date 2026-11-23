"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RouteSteps } from "@/components/flow/RouteSteps";
import { RestaurantCard } from "@/components/restaurants/RestaurantCard";
import { RestaurantImage } from "@/components/restaurants/RestaurantImage";
import { Notice } from "@/components/ui/Notice";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeliveryDraft } from "@/hooks/use-delivery-draft";
import { useRestaurant, useRestaurants } from "@/hooks/use-restaurants";

const SKELETON_COUNT = 8;

function RestaurantSkeletons() {
  return (
    <div className="restaurant-grid" aria-hidden="true">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div key={index}>
          <div className="skeleton restaurant-skeleton-photo" />
          <div className="skeleton restaurant-skeleton-line" style={{ width: "65%" }} />
          <div className="skeleton restaurant-skeleton-line" style={{ width: "85%" }} />
        </div>
      ))}
    </div>
  );
}

export function RestaurantBrowser() {
  const { draft, selectRestaurant } = useDeliveryDraft();
  const [searchInput, setSearchInput] = useState("");
  const [cuisine, setCuisine] = useState("");
  const search = useDebouncedValue(searchInput, 250);
  const { data, status, error, retry } = useRestaurants({ search, cuisine });
  const { restaurant: selected } = useRestaurant(draft.restaurantId);

  const clearFilters = () => {
    setSearchInput("");
    setCuisine("");
  };

  const showSkeleton = status === "loading" && !data;

  return (
    <>
      <div className="container page">
        <RouteSteps current="restaurant" />

        <div className="browse-header">
          <div>
            <h1 className="page-heading">Choose a restaurant</h1>
            <p className="page-intro">Your delivery route starts from its kitchen.</p>
          </div>
          <div className="browse-search input-with-icon">
            <label htmlFor="restaurant-search" className="visually-hidden">
              Search restaurants by name
            </label>
            <Search className="input-icon" size={18} aria-hidden />
            <input
              id="restaurant-search"
              className="input"
              type="search"
              placeholder="Search restaurants"
              maxLength={80}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                className="input-clear"
                aria-label="Clear search"
                onClick={() => setSearchInput("")}
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>
        </div>

        {data && data.cuisines.length > 0 && (
          <div className="cuisine-tabs" role="group" aria-label="Filter by cuisine">
            {["", ...data.cuisines].map((option) => (
              <button
                key={option || "all"}
                type="button"
                className="cuisine-tab"
                aria-pressed={cuisine === option}
                onClick={() => setCuisine(option)}
              >
                {option || "All"}
              </button>
            ))}
          </div>
        )}

        {status === "error" && (
          <Notice
            tone="error"
            title="Restaurants couldn't be loaded"
            action={
              <button type="button" className="button button-secondary" onClick={retry}>
                Try again
              </button>
            }
          >
            {error}
          </Notice>
        )}

        {showSkeleton && <RestaurantSkeletons />}

        {status !== "error" && data && data.items.length > 0 && (
          <div className="restaurant-grid" aria-busy={status === "loading"}>
            {data.items.map((restaurant, index) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                isSelected={restaurant.id === draft.restaurantId}
                eager={index < 4}
                onSelect={selectRestaurant}
              />
            ))}
          </div>
        )}

        {status === "success" && data?.items.length === 0 && (
          <div className="empty-state">
            <h2>No restaurants match your search</h2>
            <p>Try a different name, or show every cuisine.</p>
            <button type="button" className="button button-secondary" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}

        {data?.data_source === "sample" && (
          <p className="browse-source">
            Restaurant pins come from the Bengaluru training data. Names and ratings are examples.
          </p>
        )}
      </div>

      {selected && (
        <div className="selection-bar">
          <div className="container selection-bar-inner">
            <div className="selection-summary">
              <RestaurantImage src={selected.image_url} alt="" size={48} />
              <div style={{ minWidth: 0 }}>
                <p className="selection-name">{selected.name}</p>
                <p className="selection-address">{selected.address}</p>
              </div>
            </div>
            <Link
              href={`/delivery?restaurant=${encodeURIComponent(selected.id)}`}
              className="button button-primary button-lg"
            >
              Set delivery location
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
