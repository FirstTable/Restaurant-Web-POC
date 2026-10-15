"use client";

import { gql } from "@apollo/client";
import { useApolloClient } from "@apollo/client/react";
import { getErrorCode, getErrorMessage } from "@/lib/apollo-client";
import type { Permission } from "@/lib/permissions";

export const ROLES_QUERY = gql`
  query Roles($restaurantId: Int!) {
    roles(restaurantId: $restaurantId) {
      id
      name
      isOwner
      permissions
      memberCount
    }
  }
`;

export const TEAM_MEMBERS_QUERY = gql`
  query TeamMembers($restaurantId: Int!) {
    teamMembers(restaurantId: $restaurantId) {
      id
      firstName
      surname
      email
      role {
        id
        name
        isOwner
      }
    }
  }
`;

export interface Role {
  id: number;
  name: string;
  isOwner: boolean;
  permissions: Permission[];
  memberCount: number;
}

export interface TeamMember {
  id: number;
  firstName: string | null;
  surname: string | null;
  email: string;
  role: Pick<Role, "id" | "name" | "isOwner">;
}

// Roles the current user may hand out: never one with a permission they
// don't hold themselves, and never Owner unless they're FirstTable staff.
export function assignableRoles(roles: Role[], myPermissions: Permission[], isInternalAdmin: boolean) {
  return roles.filter(
    (r) => (!r.isOwner || isInternalAdmin) && r.permissions.every((p) => myPermissions.includes(p))
  );
}

// Turns a failed team/role operation into the message to show, per the
// backend's codes: 403 means our view of the user's permissions is stale, so
// refresh `me` (the tabs re-gate themselves); 404 means the member or role is
// gone, so refresh the list that showed it. 400s carry a message worth
// showing as-is — including the deliberately generic one for unknown emails.
export function useTeamErrorHandler(refetchList: () => unknown) {
  const client = useApolloClient();
  return (error: unknown): string => {
    const code = getErrorCode(error);
    if (code === 403) {
      void client.refetchQueries({ include: ["Me"] }).catch(() => {});
      return "You don't have access to do that.";
    }
    if (code === 404) {
      void Promise.resolve(refetchList()).catch(() => {});
    }
    return getErrorMessage(error);
  };
}
