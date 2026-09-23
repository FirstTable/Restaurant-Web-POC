import { createYoga } from "graphql-yoga";
import type { NextRequest } from "next/server";
import { schema } from "@/graphql/schema";

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
});

function handler(request: NextRequest) {
  return yoga.handleRequest(request, {});
}

export { handler as GET, handler as POST, handler as OPTIONS };
