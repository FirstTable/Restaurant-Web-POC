import { createYoga } from "graphql-yoga";
import type { NextRequest } from "next/server";
import { publicSchema } from "@/graphql/public-schema";

// Mock of the existing public endpoint — login only (createToken).
const yoga = createYoga({
  schema: publicSchema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
});

function handler(request: NextRequest) {
  return yoga.handleRequest(request, {});
}

export { handler as GET, handler as POST, handler as OPTIONS };
