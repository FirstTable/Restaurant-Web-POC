"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Mock "login" — no real auth, just remembers which seeded user you're
// acting as. Persisted to localStorage purely for dev convenience across
// reloads.
const STORAGE_KEY = "poc-current-user-id";

interface AuthContextValue {
  userId: string | null;
  login: (userId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setUserId(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      // localStorage unavailable (e.g. private browsing) — stay logged out
    }
  }, []);

  const login = (id: string) => {
    setUserId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  };

  const logout = () => {
    setUserId(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
