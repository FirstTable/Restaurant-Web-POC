"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useAuth } from "@/lib/auth-context";

export const ME_QUERY = gql`
  query Me {
    me {
      id
      firstName
      surname
      email
      isInternalAdmin
      restaurants {
        id
        title
        city
      }
    }
  }
`;

export interface RestaurantSummary {
  id: number;
  title: string;
  city: string | null;
}

// V1 has a single access level: every listed restaurant gets the same
// (manager-level) features, so there's no role or permission list to gate on.
export interface CurrentUser {
  id: number;
  firstName: string | null;
  surname: string | null;
  email: string;
  isInternalAdmin: boolean;
  restaurants: RestaurantSummary[];
}

export function useCurrentUser() {
  const { token } = useAuth();
  const { data, loading, error } = useQuery<{ me: CurrentUser }>(ME_QUERY, {
    skip: !token,
    fetchPolicy: "cache-and-network",
  });
  return { user: token ? data?.me ?? null : null, loading: !!token && loading, error };
}
