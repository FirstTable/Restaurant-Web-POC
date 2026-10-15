"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useAuth } from "@/lib/auth-context";
import type { Permission } from "@/lib/permissions";

export const ME_QUERY = gql`
  query Me {
    me {
      id
      firstName
      surname
      email
      isInternalAdmin
      access {
        role
        permissions
        restaurant {
          id
          title
          city
        }
      }
    }
  }
`;

export interface RestaurantSummary {
  id: number;
  title: string;
  city: string | null;
}

export interface RestaurantAccess {
  // Display name only (e.g. "Owner", or a venue's own "Host") — gate features
  // on `permissions`, never on this.
  role: string;
  permissions: Permission[];
  restaurant: RestaurantSummary;
}

export interface CurrentUser {
  id: number;
  firstName: string | null;
  surname: string | null;
  email: string;
  isInternalAdmin: boolean;
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
