import { createSchema } from "graphql-yoga";
import { findUserByCredentials } from "@/graphql/mock-users";

// Mock of the existing public /graphql endpoint — just enough to log in.
// Real endpoint has many more types; out of scope here.

const typeDefs = /* GraphQL */ `
  type CreateTokenResult {
    valid: Boolean!
    token: String
    message: String
  }

  type Query {
    ping: Boolean!
  }

  type Mutation {
    createToken(email: String!, password: String!): CreateTokenResult!
  }
`;

const resolvers = {
  Query: {
    ping: () => true,
  },
  Mutation: {
    createToken: (_: unknown, args: { email: string; password: string }) => {
      const user = findUserByCredentials(args.email, args.password);
      if (!user) {
        return { valid: false, token: null, message: "Invalid email or password." };
      }
      return { valid: true, token: user.token, message: null };
    },
  },
};

export const publicSchema = createSchema({ typeDefs, resolvers });
