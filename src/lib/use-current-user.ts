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
      access {
        role
        restaurant {
          id
          title
          city
          timezone
          currency
          sessions
        }
      }
    }
  }
`;

export type RestaurantRole = "STAFF" | "MANAGER";

export interface RestaurantSummary {
  id: string;
  title: string;
  city: string | null;
  timezone: string;
  currency: string | null;
  sessions: string[];
}

export interface RestaurantAccess {
  role: RestaurantRole;
  restaurant: RestaurantSummary;
}

export interface CurrentUser {
  id: string;
  firstName: string | null;
  surname: string | null;
  email: string;
  access: RestaurantAccess[];
}

export function useCurrentUser() {
  const { token } = useAuth();
  const { data, loading, error } = useQuery<{ me: CurrentUser }>(ME_QUERY, {
    skip: !token,
    fetchPolicy: "cache-and-network",
  });
  return { user: token ? data?.me ?? null : null, loading: !!token && loading, error };
}
