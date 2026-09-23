"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { useAuth } from "@/lib/auth-context";
import { useSelectedRestaurant } from "@/lib/use-selected-restaurant";

function LoginDialog() {
  const { login } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("manager@example.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.ok) {
      setOpen(false);
    } else {
      setError(result.message ?? "Login failed.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Log in</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log in</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <p className="text-muted-foreground text-xs">
            Try manager@example.com or staff@example.com — password is &quot;password&quot;.
          </p>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Nav() {
  const { logout } = useAuth();
  const { user, restaurantId, access, setRestaurantId } = useSelectedRestaurant();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
        <Link href="/" className="font-semibold tracking-tight">
          Restaurant POC
        </Link>

        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm">{user.firstName} {user.surname}</span>
            {user.access.length > 1 && (
              <Select value={restaurantId ?? undefined} onValueChange={setRestaurantId}>
                <SelectTrigger className="w-40" size="sm">
                  <SelectValue placeholder="Restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {user.access.map((a) => (
                    <SelectItem key={a.restaurant.id} value={a.restaurant.id}>
                      {a.restaurant.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {access && (
              <Badge variant={access.role === "MANAGER" ? "default" : "secondary"}>
                {access.role}
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={logout}>
              Log out
            </Button>
          </div>
        ) : (
          <LoginDialog />
        )}
      </div>
    </header>
  );
}
