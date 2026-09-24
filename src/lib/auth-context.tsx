"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { PUBLIC_GRAPHQL_URL, setUnauthenticatedHandler, tokenStore } from "@/lib/apollo-client";

// Login against the real local backend's public /graphql createToken
// mutation. Token is persisted to localStorage purely for dev convenience
// across reloads.
const STORAGE_KEY = "poc-restaurant-token";

interface LoginResult {
  ok: boolean;
  message?: string;
}

interface AuthContextValue {
  token: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const CREATE_TOKEN_MUTATION = /* GraphQL */ `
  mutation CreateToken($email: String!, $password: String!) {
    createToken(Email: $email, Password: $password) {
      valid
      token
      message
    }
  }
`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // One-time bootstrap from localStorage — deliberately not a subscription,
    // just an initial read of external state that can't happen during SSR.
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToken(stored);
        tokenStore.current = stored;
      }
    } catch {
      // localStorage unavailable (e.g. private browsing) — stay logged out
    }
  }, []);

  useEffect(() => {
    setUnauthenticatedHandler(logout);
    return () => setUnauthenticatedHandler(() => {});
  }, []);

  function logout() {
    setToken(null);
    tokenStore.current = null;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  async function login(email: string, password: string): Promise<LoginResult> {
    const res = await fetch(PUBLIC_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: CREATE_TOKEN_MUTATION, variables: { email, password } }),
    });
    const json = await res.json();
    const result = json.data?.createToken;
    if (!result?.valid || !result.token) {
      return { ok: false, message: result?.message ?? "Login failed." };
    }
    setToken(result.token);
    tokenStore.current = result.token;
    try {
      window.localStorage.setItem(STORAGE_KEY, result.token);
    } catch {
      // ignore
    }
    return { ok: true };
  }

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
