"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getErrorMessage } from "@/lib/apollo-client";
import {
  OWNER_LOCKED_PERMISSIONS,
  PERMISSION_INFO,
  PERMISSIONS,
  type Permission,
} from "@/lib/permissions";
import { ROLES_QUERY, useTeamErrorHandler, type Role } from "@/lib/team";
import { useSelectedRestaurant } from "@/lib/use-selected-restaurant";

const CREATE_ROLE_MUTATION = gql`
  mutation CreateRole($restaurantId: Int!, $name: String!, $permissions: [RestaurantPermission!]!) {
    createRole(restaurantId: $restaurantId, name: $name, permissions: $permissions) {
      id
    }
  }
`;

const UPDATE_ROLE_MUTATION = gql`
  mutation UpdateRole($restaurantId: Int!, $roleId: Int!, $name: String, $permissions: [RestaurantPermission!]) {
    updateRole(restaurantId: $restaurantId, roleId: $roleId, name: $name, permissions: $permissions) {
      id
    }
  }
`;

const DELETE_ROLE_MUTATION = gql`
  mutation DeleteRole($restaurantId: Int!, $roleId: Int!) {
    deleteRole(restaurantId: $restaurantId, roleId: $roleId)
  }
`;

const MAX_NAME_LENGTH = 100;

function samePermissions(a: Permission[], b: Permission[]) {
  return a.length === b.length && a.every((p) => b.includes(p));
}

// Create (no `role`) or edit (`role` given). Only permissions the current
// user holds can be ticked; the Owner role's team/role management is locked on.
function RoleDialog({
  restaurantId,
  role,
  roles,
  myPermissions,
  onError,
  trigger,
}: {
  restaurantId: number;
  role?: Role;
  roles: Role[];
  myPermissions: Permission[];
  onError: (error: unknown) => string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Permission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refetchQueries = ["Roles", "Me"];
  const [createRole, { loading: creating }] = useMutation(CREATE_ROLE_MUTATION, { refetchQueries });
  const [updateRole, { loading: updating }] = useMutation(UPDATE_ROLE_MUTATION, { refetchQueries });
  const loading = creating || updating;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(role?.name ?? "");
      setSelected(role?.permissions ?? []);
      setError(null);
    }
  }

  const isLocked = (p: Permission) => !!role?.isOwner && OWNER_LOCKED_PERMISSIONS.includes(p);
  const trimmed = name.trim();
  const duplicate = roles.some(
    (r) => r.id !== role?.id && r.name.trim().toLowerCase() === trimmed.toLowerCase()
  );

  function toggle(p: Permission, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, p] : prev.filter((x) => x !== p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Keep the dialog's tick order out of the request — send in canonical order.
    const permissions = PERMISSIONS.filter((p) => selected.includes(p));
    try {
      if (role) {
        // Omitted fields are left unchanged by the backend.
        await updateRole({
          variables: {
            restaurantId,
            roleId: role.id,
            ...(trimmed !== role.name ? { name: trimmed } : {}),
            ...(!samePermissions(permissions, role.permissions) ? { permissions } : {}),
          },
        });
      } else {
        await createRole({ variables: { restaurantId, name: trimmed, permissions } });
      }
      setOpen(false);
    } catch (err) {
      setError(onError(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? `Edit ${role.name}` : "New role"}</DialogTitle>
          <DialogDescription>You can only give a role permissions you hold yourself.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setName(e.target.value)}
              required
            />
            {duplicate && <p className="text-destructive text-xs">A role with this name already exists.</p>}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Permissions</legend>
            {PERMISSIONS.map((p) => {
              const held = myPermissions.includes(p);
              const locked = isLocked(p);
              return (
                <label
                  key={p}
                  className={`flex items-start gap-2 text-sm ${!held || locked ? "opacity-60" : ""}`}
                  title={locked ? "The Owner role always keeps this" : !held ? "You don't hold this permission" : undefined}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={locked || selected.includes(p)}
                    disabled={!held || locked}
                    onChange={(e) => toggle(p, e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">{PERMISSION_INFO[p].label}</span>
                    <span className="text-muted-foreground block text-xs">{PERMISSION_INFO[p].description}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" disabled={loading || !trimmed || duplicate}>
            {loading ? "Saving…" : role ? "Save" : "Create role"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRoleDialog({
  role,
  onConfirm,
  loading,
}: {
  role: Role;
  onConfirm: () => Promise<boolean>;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const blockedReason = role.isOwner
    ? "The Owner role can't be deleted"
    : role.memberCount > 0
      ? "Move its members first"
      : undefined;

  if (blockedReason) {
    // span so the tooltip still shows on the disabled button
    return (
      <span title={blockedReason}>
        <Button size="sm" variant="ghost" disabled>Delete</Button>
      </span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">Delete</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {role.name}?</DialogTitle>
          <DialogDescription>This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={loading}
            onClick={async () => {
              if (await onConfirm()) setOpen(false);
            }}
          >
            {loading ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RolesPanel({ restaurantId }: { restaurantId: number }) {
  const { permissions } = useSelectedRestaurant();
  const rolesQuery = useQuery<{ roles: Role[] }>(ROLES_QUERY, {
    variables: { restaurantId },
    fetchPolicy: "cache-and-network",
  });
  const handleError = useTeamErrorHandler(() => rolesQuery.refetch());
  const [deleteRole, { loading: deleting }] = useMutation(DELETE_ROLE_MUTATION, {
    refetchQueries: ["Roles"],
  });
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDelete(roleId: number) {
    setActionError(null);
    try {
      await deleteRole({ variables: { restaurantId, roleId } });
      return true;
    } catch (err) {
      setActionError(handleError(err));
      return false;
    }
  }

  const roles = rolesQuery.data?.roles;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <RoleDialog
          restaurantId={restaurantId}
          roles={roles ?? []}
          myPermissions={permissions}
          onError={handleError}
          trigger={<Button size="sm" variant="outline">New role</Button>}
        />
      </div>
      {actionError && <p className="text-destructive text-sm">{actionError}</p>}
      {!roles && rolesQuery.loading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {rolesQuery.error && <p className="text-destructive text-sm">{getErrorMessage(rolesQuery.error)}</p>}
      {roles && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Members</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((r) => {
              // Editing a role that holds permissions you don't would mean
              // saving permissions you can't grant — the server refuses it.
              const editable = r.permissions.every((p) => permissions.includes(p));
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap gap-1">
                      {PERMISSIONS.filter((p) => r.permissions.includes(p)).map((p) => (
                        <Badge key={p} variant="secondary" title={PERMISSION_INFO[p].description}>
                          {PERMISSION_INFO[p].label}
                        </Badge>
                      ))}
                      {r.permissions.length === 0 && <span className="text-muted-foreground text-xs">None</span>}
                    </div>
                  </TableCell>
                  <TableCell>{r.memberCount}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {editable ? (
                        <RoleDialog
                          restaurantId={restaurantId}
                          role={r}
                          roles={roles}
                          myPermissions={permissions}
                          onError={handleError}
                          trigger={<Button size="sm" variant="ghost">Edit</Button>}
                        />
                      ) : (
                        <span title="Has permissions you don't hold">
                          <Button size="sm" variant="ghost" disabled>Edit</Button>
                        </span>
                      )}
                      <DeleteRoleDialog role={r} loading={deleting} onConfirm={() => handleDelete(r.id)} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
