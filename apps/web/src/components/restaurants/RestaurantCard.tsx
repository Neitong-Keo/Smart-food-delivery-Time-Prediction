import { Check, Star } from "lucide-react";

import { RestaurantImage } from "@/components/restaurants/RestaurantImage";
import type { Restaurant } from "@/types/restaurant";

interface RestaurantCardProps {
  restaurant: Restaurant;
  isSelected: boolean;
  eager: boolean;
  onSelect: (id: string) => void;
}

export function RestaurantCard({ restaurant, isSelected, eager, onSelect }: RestaurantCardProps) {
  return (
    <button
      type="button"
      className="restaurant-card"
      aria-pressed={isSelected}
      onClick={() => onSelect(restaurant.id)}
    >
      <div className="restaurant-photo">
        <RestaurantImage src={restaurant.image_url} alt="" eager={eager} />
        {isSelected && (
          <span className="restaurant-check" aria-hidden="true">
            <Check size={16} strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="restaurant-info">
        <div className="restaurant-title-row">
          <h2 className="restaurant-name">{restaurant.name}</h2>
          {restaurant.rating !== null && (
            <span className="restaurant-rating" aria-label={`Rated ${restaurant.rating} out of 5`}>
              <Star size={13} aria-hidden />
              {restaurant.rating.toFixed(1)}
            </span>
          )}
        </div>
        {restaurant.cuisine && <p className="restaurant-cuisine">{restaurant.cuisine}</p>}
        <p className="restaurant-address">{restaurant.address}</p>
      </div>
    </button>
  );
}
