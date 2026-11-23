export interface Restaurant {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  cuisine: string | null;
  rating: number | null;
  image_url: string | null;
  city_type: string;
  time_zone?: string | null;
}

export interface RestaurantListResponse {
  items: Restaurant[];
  total: number;
  cuisines: string[];
  data_source: "sample" | "database";
}

export interface RestaurantFilters {
  search?: string;
  cuisine?: string;
}
