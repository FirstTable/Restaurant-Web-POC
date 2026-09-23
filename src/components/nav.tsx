"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useCurrentUser } from "@/lib/use-current-user";

export function Nav() {
  const { login, logout } = useAuth();
  const { user, allUsers, loading } = useCurrentUser();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
        <Link href="/" className="font-semibold tracking-tight">
          Restaurant POC
        </Link>

        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm">{user.name}</span>
            <Badge variant={user.role === "MANAGER" ? "default" : "secondary"}>
              {user.role}
            </Badge>
            <Button size="sm" variant="outline" onClick={logout}>
              Log out
            </Button>
          </div>
        ) : (
          <Select disabled={loading} onValueChange={login}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Log in as…" />
            </SelectTrigger>
            <SelectContent>
              {allUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} — {u.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </header>
  );
}
