import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from "@apollo/client";
import type { GraphQLFormattedError } from "graphql";
import { CombinedGraphQLErrors, ServerError } from "@apollo/client/errors";
import { ErrorLink } from "@apollo/client/link/error";

// Real backend's error envelope is flat — {message, status, code} — not the
// spec-standard {message, extensions: {code}}. It also answers with a real
// non-2xx HTTP status per error, which means Apollo's HttpLink treats it as
// a ServerError (network-level), never a CombinedGraphQLErrors — the parsed
// body (message/status/code) only survives on ServerError.bodyText as raw
// text, so it must be parsed back out by hand.
interface RestaurantApiError extends GraphQLFormattedError {
  code?: number;
  status?: string;
}

function parseRestaurantApiErrors(bodyText: string): RestaurantApiError[] {
  try {
    const parsed = JSON.parse(bodyText);
    return Array.isArray(parsed?.errors) ? parsed.errors : [];
  } catch {
    return [];
  }
}

// Best-effort message for a caught Apollo error, unwrapping this backend's
// non-standard shapes rather than showing a generic "status 403" string.
export function getErrorMessage(error: unknown): string {
  if (ServerError.is(error)) {
    const errors = parseRestaurantApiErrors(error.bodyText);
    return errors[0]?.message ?? error.message;
  }
  if (CombinedGraphQLErrors.is(error)) {
    return error.errors[0]?.message ?? error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export const RESTAURANT_GRAPHQL_URL = "https://firsttable.local/restaurant-graphql";
export const PUBLIC_GRAPHQL_URL = "https://firsttable.local/graphql";

// Mutable token holder read by the auth link on every request. Kept outside
// React state so the Apollo Client instance (created once) doesn't need to
// be rebuilt when the token changes.
export const tokenStore = { current: null as string | null };

// Called by AuthProvider when the server says the token is no good.
let onUnauthenticated: (() => void) | null = null;
export function setUnauthenticatedHandler(fn: () => void) {
  onUnauthenticated = fn;
}

const authLink = new ApolloLink((operation, forward) => {
  if (tokenStore.current) {
    operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
      headers: {
        ...headers,
        "Application-Authorization": `Bearer ${tokenStore.current}`,
      },
    }));
  }
  return forward(operation);
});

const errorLink = new ErrorLink(({ error }) => {
  if (ServerError.is(error) && error.statusCode === 401) {
    onUnauthenticated?.();
    return;
  }
  if (CombinedGraphQLErrors.is(error)) {
    const errors = error.errors as RestaurantApiError[];
    const isUnauthenticated = errors.some((e) => e.code === 401 || e.extensions?.code === "UNAUTHENTICATED");
    if (isUnauthenticated) onUnauthenticated?.();
  }
});

export function makeApolloClient() {
  return new ApolloClient({
    link: ApolloLink.from([errorLink, authLink, new HttpLink({ uri: RESTAURANT_GRAPHQL_URL })]),
    cache: new InMemoryCache(),
  });
}
