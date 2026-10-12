import { createYoga } from "graphql-yoga";
import type { NextRequest } from "next/server";
import { restaurantSchema, resolveCurrentUser, type RequestContext } from "@/graphql/restaurant-schema";

// Mock of the proposed /restaurant-graphql endpoint. Every operation reads
// Application-Authorization: Bearer <token> — no anonymous fallback.
const yoga = createYoga({
  schema: restaurantSchema,
  graphqlEndpoint: "/api/restaurant-graphql",
  fetchAPI: { Response },
  context: async ({ request }): Promise<RequestContext> => ({
    currentUser: resolveCurrentUser(request.headers.get("Application-Authorization")),
  }),
});

function handler(request: NextRequest) {
  return yoga.handleRequest(request, {});
}

export { handler as GET, handler as POST, handler as OPTIONS };
