"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useRestaurantContext } from "@/lib/restaurant-context";

// The restaurant the nav/dashboard are scoped to, and the current user's
// access (role + restaurant) for it — shared so the nav's role badge always
// matches whatever the dashboard has selected.
export function useSelectedRestaurant() {
  const { user, loading } = useCurrentUser();
  const { manualRestaurantId, setManualRestaurantId } = useRestaurantContext();
  const restaurantId = manualRestaurantId ?? user?.access[0]?.restaurant.id ?? null;
  const access = user?.access.find((a) => a.restaurant.id === restaurantId) ?? null;
  return { user, loading, restaurantId, access, setRestaurantId: setManualRestaurantId };
}
