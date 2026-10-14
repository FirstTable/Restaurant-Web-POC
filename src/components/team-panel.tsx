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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  assignableRoles,
  ROLES_QUERY,
  TEAM_MEMBERS_QUERY,
  useTeamErrorHandler,
  type Role,
  type TeamMember,
} from "@/lib/team";
import { useSelectedRestaurant } from "@/lib/use-selected-restaurant";

const ADD_MEMBER_MUTATION = gql`
  mutation AddMember($restaurantId: Int!, $email: String!, $roleId: Int!) {
    addMember(restaurantId: $restaurantId, email: $email, roleId: $roleId) {
      id
    }
  }
`;

const CHANGE_MEMBER_ROLE_MUTATION = gql`
  mutation ChangeMemberRole($restaurantId: Int!, $memberId: Int!, $roleId: Int!) {
    changeMemberRole(restaurantId: $restaurantId, memberId: $memberId, roleId: $roleId) {
      id
    }
  }
`;

const REMOVE_MEMBER_MUTATION = gql`
  mutation RemoveMember($restaurantId: Int!, $memberId: Int!) {
    removeMember(restaurantId: $restaurantId, memberId: $memberId)
  }
`;

function displayName(m: TeamMember) {
  return [m.firstName, m.surname].filter(Boolean).join(" ") || m.email;
}

function AddMemberDialog({
  restaurantId,
  roles,
  onError,
}: {
  restaurantId: number;
  roles: Role[];
  onError: (error: unknown) => string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [addMember, { loading }] = useMutation(ADD_MEMBER_MUTATION, {
    refetchQueries: ["TeamMembers", "Roles"],
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setEmail("");
      setRoleId("");
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addMember({ variables: { restaurantId, email: email.trim(), roleId: Number(roleId) } });
      setOpen(false);
    } catch (err) {
      setError(onError(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={roles.length === 0}>
          Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>
            They need an existing FirstTable account. They&apos;re added straight away.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="member-email">Email</Label>
            <Input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a role" /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" disabled={loading || !roleId}>
            {loading ? "Adding…" : "Add member"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveMemberDialog({
  member,
  onConfirm,
  loading,
}: {
  member: TeamMember;
  onConfirm: () => Promise<boolean>;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">Remove</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {displayName(member)}?</DialogTitle>
          <DialogDescription>
            They&apos;ll lose access to this restaurant in the app straight away.
          </DialogDescription>
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
            {loading ? "Removing…" : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeamPanel({ restaurantId }: { restaurantId: number }) {
  const { user, permissions } = useSelectedRestaurant();
  const membersQuery = useQuery<{ teamMembers: TeamMember[] }>(TEAM_MEMBERS_QUERY, {
    variables: { restaurantId },
    fetchPolicy: "cache-and-network",
  });
  const rolesQuery = useQuery<{ roles: Role[] }>(ROLES_QUERY, {
    variables: { restaurantId },
    fetchPolicy: "cache-and-network",
  });
  const handleError = useTeamErrorHandler(() => membersQuery.refetch());
  // Refetch `me` too, so the app re-gates if this somehow touched the
  // current user's own access.
  const [changeMemberRole] = useMutation(CHANGE_MEMBER_ROLE_MUTATION, {
    refetchQueries: ["TeamMembers", "Roles", "Me"],
  });
  const [removeMember, { loading: removing }] = useMutation(REMOVE_MEMBER_MUTATION, {
    refetchQueries: ["TeamMembers", "Roles", "Me"],
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<number | null>(null);

  const assignable = assignableRoles(rolesQuery.data?.roles ?? [], permissions, !!user?.isInternalAdmin);

  async function handleChangeRole(memberId: number, roleId: string) {
    setActionError(null);
    setPendingMemberId(memberId);
    try {
      await changeMemberRole({ variables: { restaurantId, memberId, roleId: Number(roleId) } });
    } catch (err) {
      setActionError(handleError(err));
    } finally {
      setPendingMemberId(null);
    }
  }

  async function handleRemove(memberId: number) {
    setActionError(null);
    try {
      await removeMember({ variables: { restaurantId, memberId } });
      return true;
    } catch (err) {
      setActionError(handleError(err));
      return false;
    }
  }

  const members = membersQuery.data?.teamMembers;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <AddMemberDialog restaurantId={restaurantId} roles={assignable} onError={handleError} />
      </div>
      {actionError && <p className="text-destructive text-sm">{actionError}</p>}
      {!members && membersQuery.loading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {membersQuery.error && <p className="text-destructive text-sm">{getErrorMessage(membersQuery.error)}</p>}
      {members && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              // Your own row and the Owner's are read-only here; the server
              // refuses both anyway.
              const locked = m.id === user?.id || m.role.isOwner;
              // Keep the member's current role selectable as the shown value
              // even when it's not one the user may hand out.
              const options = assignable.some((r) => r.id === m.role.id)
                ? assignable
                : [{ ...m.role, disabled: true }, ...assignable];
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    {displayName(m)}
                    {m.id === user?.id && <span className="text-muted-foreground text-xs"> (you)</span>}
                  </TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    {locked ? (
                      <Badge variant={m.role.isOwner ? "default" : "secondary"}>{m.role.name}</Badge>
                    ) : (
                      <Select
                        value={String(m.role.id)}
                        onValueChange={(v) => handleChangeRole(m.id, v)}
                        disabled={pendingMemberId === m.id}
                      >
                        <SelectTrigger className="w-40" size="sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {options.map((r) => (
                            <SelectItem
                              key={r.id}
                              value={String(r.id)}
                              disabled={"disabled" in r && r.disabled}
                            >
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!locked && (
                      <RemoveMemberDialog member={m} loading={removing} onConfirm={() => handleRemove(m.id)} />
                    )}
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
