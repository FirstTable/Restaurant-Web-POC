"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { getErrorMessage } from "@/lib/apollo-client";
import { PERMISSION_INFO, type Permission } from "@/lib/permissions";

const TEAM_ACTIVITY_QUERY = gql`
  query TeamActivity($restaurantId: Int!) {
    teamActivity(restaurantId: $restaurantId, limit: 50) {
      id
      action
      actorEmail
      targetLabel
      before
      after
      occurredAt
    }
  }
`;

interface TeamActivity {
  id: number;
  action: string;
  actorEmail: string | null;
  targetLabel: string;
  before: string | null;
  after: string | null;
  occurredAt: string;
}

// before/after are JSON strings: {role} for member actions, {name,
// permissions} for role actions (RoleUpdated's `after` adds
// permissionsAdded / permissionsRemoved).
interface Snapshot {
  role?: string;
  name?: string;
  permissions?: Permission[];
  permissionsAdded?: Permission[];
  permissionsRemoved?: Permission[];
}

function parseSnapshot(json: string | null): Snapshot {
  if (!json) return {};
  try {
    return JSON.parse(json) ?? {};
  } catch {
    return {};
  }
}

function permissionList(permissions: Permission[] | undefined) {
  if (!permissions?.length) return "no permissions";
  return permissions.map((p) => PERMISSION_INFO[p]?.label ?? p).join(", ");
}

function describe(entry: TeamActivity) {
  const actor = entry.actorEmail ?? "FirstTable";
  const target = entry.targetLabel;
  const before = parseSnapshot(entry.before);
  const after = parseSnapshot(entry.after);

  switch (entry.action) {
    case "MemberAdded":
      return `${actor} added ${target} as ${after.role ?? "a member"}`;
    case "MemberRemoved":
      return `${actor} removed ${target}${before.role ? ` (was ${before.role})` : ""}`;
    case "RoleChanged":
      return `${actor} changed ${target} from ${before.role ?? "?"} to ${after.role ?? "?"}`;
    case "RoleCreated":
      return `${actor} created the role ${target} with ${permissionList(after.permissions)}`;
    case "RoleUpdated": {
      const changes: string[] = [];
      if (before.name && after.name && before.name !== after.name) {
        changes.push(`renamed it from ${before.name} to ${after.name}`);
      }
      if (after.permissionsAdded?.length) changes.push(`added ${permissionList(after.permissionsAdded)}`);
      if (after.permissionsRemoved?.length) changes.push(`removed ${permissionList(after.permissionsRemoved)}`);
      return `${actor} updated the role ${target}${changes.length ? `: ${changes.join("; ")}` : ""}`;
    }
    case "RoleDeleted":
      return `${actor} deleted the role ${target}`;
    default:
      return `${actor}: ${entry.action} ${target}`;
  }
}

export function ActivityPanel({ restaurantId }: { restaurantId: number }) {
  const { data, loading, error } = useQuery<{ teamActivity: TeamActivity[] }>(TEAM_ACTIVITY_QUERY, {
    variables: { restaurantId },
    fetchPolicy: "cache-and-network",
  });
  const entries = data?.teamActivity;

  return (
    <div className="flex flex-col gap-3">
      {!entries && loading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {error && <p className="text-destructive text-sm">{getErrorMessage(error)}</p>}
      {entries && entries.length === 0 && <p className="text-muted-foreground text-sm">No team changes yet.</p>}
      {entries && entries.length > 0 && (
        <ul className="flex flex-col divide-y text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
              <span>{describe(e)}</span>
              {/* occurredAt is ISO 8601 UTC; shown in the browser's local time. */}
              <time dateTime={e.occurredAt} className="text-muted-foreground shrink-0 text-xs">
                {new Date(e.occurredAt).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
