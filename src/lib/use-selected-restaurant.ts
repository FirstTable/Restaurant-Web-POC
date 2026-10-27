"use client";

import { useParams, useRouter } from "next/navigation";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useCurrentUser, type RestaurantSummary } from "@/lib/use-current-user";

const RESTAURANT_QUERY = gql`
  query Restaurant($id: Int!) {
    restaurant(id: $id) {
      id
      title
      city
    }
  }
`;

function parseRestaurantId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// The restaurant the nav/dashboard are scoped to. Scoping lives in the URL
// (/dashboard/[restaurantId]) rather than component state, so a specific
// venue's dashboard is a real, shareable link — falls back to the user's
// first restaurant when there's no id in the URL (e.g. on /).
//
// Internal admins come back with an empty `restaurants` list by design: the
// backend lets them act on any restaurant rather than listing every one. For
// them the selected restaurant is fetched by ID instead.
export function useSelectedRestaurant() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const params = useParams<{ restaurantId?: string }>();
  const urlRestaurantId = parseRestaurantId(params?.restaurantId);
  const restaurantId = urlRestaurantId ?? user?.restaurants[0]?.id ?? null;
  const mapped = user?.restaurants.find((r) => r.id === restaurantId) ?? null;

  const needsLookup = !!user?.isInternalAdmin && restaurantId != null && !mapped;
  const lookup = useQuery<{ restaurant: RestaurantSummary | null }>(RESTAURANT_QUERY, {
    variables: { id: restaurantId ?? 0 },
    skip: !needsLookup,
  });

  const restaurant: RestaurantSummary | null =
    mapped ?? (needsLookup ? lookup.data?.restaurant ?? null : null);

  function setRestaurantId(id: number) {
    router.push(`/dashboard/${id}`);
  }

  return {
    user,
    loading,
    restaurantId,
    restaurant,
    lookupLoading: needsLookup && lookup.loading,
    lookupError: needsLookup ? lookup.error ?? null : null,
    setRestaurantId,
  };
}
