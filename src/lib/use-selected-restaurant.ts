"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import {
  useCurrentUser,
  type RestaurantAccess,
  type RestaurantSummary,
} from "@/lib/use-current-user";
import { useRestaurantContext } from "@/lib/restaurant-context";

const RESTAURANT_QUERY = gql`
  query Restaurant($id: Int!) {
    restaurant(id: $id) {
      id
      title
      city
    }
  }
`;

// The restaurant the nav/dashboard are scoped to, and the current user's
// access (role + restaurant) for it — shared so the nav's role badge always
// matches whatever the dashboard has selected.
//
// Internal admins come back with an empty `access` list by design: the
// backend lets them act on any restaurant rather than listing every one. For
// them the selected restaurant is fetched by ID and treated as MANAGER, which
// is what RestaurantAccessService grants on the backend.
export function useSelectedRestaurant() {
  const { user, loading } = useCurrentUser();
  const { manualRestaurantId, setManualRestaurantId } = useRestaurantContext();
  const restaurantId = manualRestaurantId ?? user?.access[0]?.restaurant.id ?? null;
  const mapped = user?.access.find((a) => a.restaurant.id === restaurantId) ?? null;

  const needsLookup = !!user?.isInternalAdmin && restaurantId != null && !mapped;
  const lookup = useQuery<{ restaurant: RestaurantSummary | null }>(RESTAURANT_QUERY, {
    variables: { id: restaurantId ?? 0 },
    skip: !needsLookup,
  });

  const access: RestaurantAccess | null =
    mapped ??
    (needsLookup && lookup.data?.restaurant
      ? { role: "MANAGER", restaurant: lookup.data.restaurant }
      : null);

  return {
    user,
    loading,
    restaurantId,
    access,
    lookupLoading: needsLookup && lookup.loading,
    lookupError: needsLookup ? lookup.error ?? null : null,
    setRestaurantId: setManualRestaurantId,
  };
}
