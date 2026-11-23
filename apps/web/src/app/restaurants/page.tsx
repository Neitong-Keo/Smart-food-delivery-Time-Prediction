import type { Metadata } from "next";

import { RestaurantBrowser } from "@/components/restaurants/RestaurantBrowser";

export const metadata: Metadata = { title: "Restaurants" };

export default function RestaurantsPage() {
  return <RestaurantBrowser />;
}
