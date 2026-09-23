import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ErrorLink } from "@apollo/client/link/error";

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
  if (CombinedGraphQLErrors.is(error)) {
    const isUnauthenticated = error.errors.some((e) => e.extensions?.code === "UNAUTHENTICATED");
    if (isUnauthenticated) onUnauthenticated?.();
  }
});

export function makeApolloClient() {
  return new ApolloClient({
    link: ApolloLink.from([errorLink, authLink, new HttpLink({ uri: "/api/restaurant-graphql" })]),
    cache: new InMemoryCache(),
  });
}
