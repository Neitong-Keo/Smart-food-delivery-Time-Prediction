import { parseRestaurant, parseRestaurantList } from "@/lib/validators";
import { apiRequest } from "@/services/api/api-client";
import type { Restaurant, RestaurantFilters, RestaurantListResponse } from "@/types/restaurant";

export function listRestaurants(
  filters: RestaurantFilters,
  signal?: AbortSignal,
): Promise<RestaurantListResponse> {
  const query = new URLSearchParams();
  if (filters.search?.trim()) query.set("search", filters.search.trim());
  if (filters.cuisine) query.set("cuisine", filters.cuisine);
  const suffix = query.size ? `?${query}` : "";
  return apiRequest(`/api/restaurants${suffix}`, { signal, parse: parseRestaurantList });
}

export function getRestaurant(id: string, signal?: AbortSignal): Promise<Restaurant> {
  return apiRequest(`/api/restaurants/${encodeURIComponent(id)}`, {
    signal,
    parse: parseRestaurant,
  });
}
