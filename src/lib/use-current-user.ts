"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useAuth } from "@/lib/auth-context";

export const USERS_QUERY = gql`
  query Users {
    users {
      id
      name
      email
      role
      restaurants {
        id
        name
      }
    }
  }
`;

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "STAFF" | "MANAGER";
  restaurants: { id: string; name: string }[];
}

export function useCurrentUser() {
  const { userId } = useAuth();
  const { data, loading } = useQuery<{ users: CurrentUser[] }>(USERS_QUERY);
  const allUsers = data?.users ?? [];
  const user = userId ? allUsers.find((u) => u.id === userId) ?? null : null;
  return { user, allUsers, loading };
}
