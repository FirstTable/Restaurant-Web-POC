import { createSchema, createGraphQLError } from "graphql-yoga";
import { GraphQLScalarType, Kind } from "graphql";
import { restaurants, findUserByToken, type MockUser, type Session } from "@/graphql/mock-users";

// Mock of the proposed /restaurant-graphql endpoint (PD-6967 handover).
// Auth: Application-Authorization: Bearer <token>, token from createToken
// on the public schema. Role is per-restaurant (currentUser.access[]).

export interface RequestContext {
  currentUser?: MockUser;
}

type ReservationState = "BOOKED" | "CHECKED_IN" | "NOT_APPEARED" | "CANCELLED";
type CapacityLimit = "TABLES" | "PAX" | "BOTH";

interface Reservation {
  id: string;
  restaurantId: string;
  reference: string;
  guestName: string;
  phone: string | null;
  date: string;
  time: string;
  dateTimeUTC: string;
  session: Session;
  partySize: number;
  state: ReservationState;
  checkedInAt: string | null;
  notAppearedAt: string | null;
  dietaryRequirements: string | null;
  comments: string | null;
  firstVisit: boolean;
}

interface AvailabilitySlot {
  id: string;
  restaurantId: string;
  date: string;
  time: string;
  session: Session;
  limitBy: CapacityLimit;
  tablesAvailable: number;
  tablesSold: number;
  paxAvailable: number;
  paxSold: number;
  partySizes: string | null;
  price: string | null;
  discount: number | null;
  locked: boolean;
}

// --- seed data, matching the handover's mock-data.json -------------------

const reservations: Reservation[] = [
  { id: "9001", restaurantId: "101", reference: "FT8K2QDX", guestName: "Priya Nair", phone: "+64 21 555 0143", date: "2026-10-04", time: "18:00:00", dateTimeUTC: "2026-10-04T05:00:00Z", session: "DINNER", partySize: 2, state: "CHECKED_IN", checkedInAt: "2026-10-04T05:03:11Z", notAppearedAt: null, dietaryRequirements: "One gluten free", comments: "Anniversary — window table if possible", firstVisit: true },
  { id: "9002", restaurantId: "101", reference: "FT4M7PLA", guestName: "Tom Whitaker", phone: "+64 27 555 0918", date: "2026-10-04", time: "18:15:00", dateTimeUTC: "2026-10-04T05:15:00Z", session: "DINNER", partySize: 4, state: "BOOKED", checkedInAt: null, notAppearedAt: null, dietaryRequirements: null, comments: null, firstVisit: false },
  { id: "9003", restaurantId: "101", reference: "FT1Z9RBN", guestName: "Mei Lin", phone: "+64 22 555 0277", date: "2026-10-04", time: "18:30:00", dateTimeUTC: "2026-10-04T05:30:00Z", session: "DINNER", partySize: 2, state: "NOT_APPEARED", checkedInAt: null, notAppearedAt: "2026-10-04T05:52:40Z", dietaryRequirements: null, comments: null, firstVisit: true },
  { id: "9004", restaurantId: "101", reference: "FT6Q3WKE", guestName: "Daniel Osei", phone: "+64 21 555 0466", date: "2026-10-05", time: "12:00:00", dateTimeUTC: "2026-10-04T23:00:00Z", session: "LUNCH", partySize: 3, state: "BOOKED", checkedInAt: null, notAppearedAt: null, dietaryRequirements: "Nut allergy", comments: null, firstVisit: false },
  { id: "9005", restaurantId: "101", reference: "FT2H8VCT", guestName: "Ellie Barnes", phone: null, date: "2026-10-05", time: "18:00:00", dateTimeUTC: "2026-10-05T05:00:00Z", session: "DINNER", partySize: 6, state: "CANCELLED", checkedInAt: null, notAppearedAt: null, dietaryRequirements: null, comments: null, firstVisit: false },
  { id: "9101", restaurantId: "103", reference: "FT5R1NDQ", guestName: "Jonah Patel", phone: "+64 21 555 0788", date: "2026-10-04", time: "19:00:00", dateTimeUTC: "2026-10-04T06:00:00Z", session: "DINNER", partySize: 2, state: "BOOKED", checkedInAt: null, notAppearedAt: null, dietaryRequirements: null, comments: null, firstVisit: true },
];

let availabilitySlots: AvailabilitySlot[] = [
  { id: "5001", restaurantId: "101", date: "2026-10-04", time: "18:00:00", session: "DINNER", limitBy: "TABLES", tablesAvailable: 1, tablesSold: 1, paxAvailable: 0, paxSold: 2, partySizes: "2,3,4", price: "25.00", discount: 0.5, locked: false },
  { id: "5002", restaurantId: "101", date: "2026-10-04", time: "18:15:00", session: "DINNER", limitBy: "TABLES", tablesAvailable: 0, tablesSold: 1, paxAvailable: 0, paxSold: 4, partySizes: "2,3,4", price: "25.00", discount: 0.5, locked: false },
  { id: "5003", restaurantId: "101", date: "2026-10-04", time: "18:30:00", session: "DINNER", limitBy: "TABLES", tablesAvailable: 2, tablesSold: 1, paxAvailable: 0, paxSold: 2, partySizes: "2,3,4", price: "25.00", discount: 0.5, locked: true },
  { id: "5004", restaurantId: "101", date: "2026-10-05", time: "12:00:00", session: "LUNCH", limitBy: "TABLES", tablesAvailable: 4, tablesSold: 1, paxAvailable: 0, paxSold: 3, partySizes: "2,3,4", price: "20.00", discount: 0.5, locked: false },
];

let nextSlotSeq = 5100;

// --- error helpers ---------------------------------------------------------

function unauthenticated(): never {
  throw createGraphQLError("Authentication required.", {
    extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
  });
}

function forbiddenRestaurant(restaurantId: string): never {
  throw createGraphQLError("You do not have access to this restaurant.", {
    extensions: { code: "FORBIDDEN", restaurantId, http: { status: 403 } },
  });
}

function forbiddenRole(restaurantId: string, requiredRole: string): never {
  throw createGraphQLError(`This action requires the ${requiredRole} role.`, {
    extensions: { code: "FORBIDDEN", requiredRole, restaurantId, http: { status: 403 } },
  });
}

function notFound(message: string): never {
  throw createGraphQLError(message, {
    extensions: { code: "NOT_FOUND", http: { status: 404 } },
  });
}

function badUserInput(message: string, field: string): never {
  throw createGraphQLError(message, {
    extensions: { code: "BAD_USER_INPUT", field, http: { status: 400 } },
  });
}

function slotLocked(availabilityId: string): never {
  throw createGraphQLError("This slot is locked and cannot be changed from the restaurant app.", {
    extensions: { code: "SLOT_LOCKED", availabilityId, http: { status: 409 } },
  });
}

function requireAuth(context: RequestContext): MockUser {
  if (!context.currentUser) unauthenticated();
  return context.currentUser;
}

function requireAccess(context: RequestContext, restaurantId: string) {
  const user = requireAuth(context);
  const access = user.access.find((a) => a.restaurantId === restaurantId);
  if (!access) forbiddenRestaurant(restaurantId);
  return access;
}

function requireRole(context: RequestContext, restaurantId: string, role: "MANAGER") {
  const access = requireAccess(context, restaurantId);
  if (access.role !== role) forbiddenRole(restaurantId, role);
}

// --- scalars ---------------------------------------------------------------

function passthroughScalar(name: string) {
  return new GraphQLScalarType({
    name,
    serialize: (value) => value,
    parseValue: (value) => value,
    parseLiteral: (ast) => (ast.kind === Kind.STRING ? ast.value : null),
  });
}

// --- schema ------------------------------------------------------------

const typeDefs = /* GraphQL */ `
  scalar Date
  scalar Time
  scalar DateTime

  enum RestaurantRole {
    STAFF
    MANAGER
  }

  enum Session {
    BREAKFAST
    LUNCH
    DINNER
    DINNER2
  }

  enum ReservationState {
    BOOKED
    CHECKED_IN
    NOT_APPEARED
    CANCELLED
  }

  enum ReservationStateChange {
    BOOKED
    CHECKED_IN
    NOT_APPEARED
  }

  enum CapacityLimit {
    TABLES
    PAX
    BOTH
  }

  type RestaurantUser {
    id: ID!
    firstName: String
    surname: String
    email: String!
    access: [RestaurantAccess!]!
  }

  type RestaurantAccess {
    restaurant: Restaurant!
    role: RestaurantRole!
  }

  type Restaurant {
    id: ID!
    title: String!
    city: String
    timezone: String!
    currency: String
    sessions: [Session!]!
  }

  type Reservation {
    id: ID!
    reference: String!
    guestName: String!
    phone: String
    date: Date!
    time: Time!
    dateTimeUTC: DateTime!
    session: Session!
    partySize: Int!
    state: ReservationState!
    checkedInAt: DateTime
    notAppearedAt: DateTime
    dietaryRequirements: String
    comments: String
    firstVisit: Boolean!
  }

  type AvailabilitySlot {
    id: ID!
    date: Date!
    time: Time!
    session: Session!
    limitBy: CapacityLimit!
    tablesAvailable: Int!
    tablesSold: Int!
    paxAvailable: Int!
    paxSold: Int!
    partySizes: String
    price: String
    discount: Float
    locked: Boolean!
  }

  type ScheduleDay {
    date: Date!
    isClosed: Boolean!
    slots: [AvailabilitySlot!]!
    tablesAvailable: Int!
    tablesSold: Int!
  }

  type Query {
    me: RestaurantUser!
    restaurant(id: ID!): Restaurant!
    reservations(restaurantId: ID!, from: Date!, to: Date, session: Session): [Reservation!]!
    schedule(restaurantId: ID!, from: Date!, to: Date!): [ScheduleDay!]!
  }

  input AddAvailabilityInput {
    restaurantId: ID!
    date: Date!
    session: Session!
    times: [Time!]!
    limitBy: CapacityLimit = TABLES
    tables: Int!
    paxAvailable: Int
    partySizes: String
  }

  input AddTablesInput {
    restaurantId: ID!
    availabilityId: ID!
    tables: Int!
  }

  type Mutation {
    changeReservationState(restaurantId: ID!, reservationId: ID!, state: ReservationStateChange!): Reservation!
    addAvailability(input: AddAvailabilityInput!): [AvailabilitySlot!]!
    addTables(input: AddTablesInput!): AvailabilitySlot!
  }
`;

const resolvers = {
  Date: passthroughScalar("Date"),
  Time: passthroughScalar("Time"),
  DateTime: passthroughScalar("DateTime"),

  RestaurantAccess: {
    restaurant: (access: { restaurantId: string }) =>
      restaurants.find((r) => r.id === access.restaurantId),
  },

  Query: {
    me: (_: unknown, __: unknown, context: RequestContext) => {
      const user = requireAuth(context);
      return user;
    },
    restaurant: (_: unknown, args: { id: string }, context: RequestContext) => {
      requireAccess(context, args.id);
      const restaurant = restaurants.find((r) => r.id === args.id);
      if (!restaurant) notFound("Restaurant not found.");
      return restaurant;
    },
    reservations: (
      _: unknown,
      args: { restaurantId: string; from: string; to?: string; session?: Session },
      context: RequestContext,
    ) => {
      requireAccess(context, args.restaurantId);
      const from = args.from;
      const to = args.to ?? args.from;
      return reservations
        .filter((r) => r.restaurantId === args.restaurantId)
        .filter((r) => r.date >= from && r.date <= to)
        .filter((r) => (args.session ? r.session === args.session : true))
        .sort((a, b) => a.dateTimeUTC.localeCompare(b.dateTimeUTC));
    },
    schedule: (
      _: unknown,
      args: { restaurantId: string; from: string; to: string },
      context: RequestContext,
    ) => {
      requireAccess(context, args.restaurantId);
      const days: string[] = [];
      for (let d = new Date(`${args.from}T00:00:00Z`); d <= new Date(`${args.to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
        days.push(d.toISOString().slice(0, 10));
      }
      return days.map((date) => {
        const slots = availabilitySlots.filter((s) => s.restaurantId === args.restaurantId && s.date === date);
        return {
          date,
          isClosed: slots.length === 0,
          slots,
          tablesAvailable: slots.reduce((sum, s) => sum + s.tablesAvailable, 0),
          tablesSold: slots.reduce((sum, s) => sum + s.tablesSold, 0),
        };
      });
    },
  },

  Mutation: {
    changeReservationState: (
      _: unknown,
      args: { restaurantId: string; reservationId: string; state: "BOOKED" | "CHECKED_IN" | "NOT_APPEARED" },
      context: RequestContext,
    ) => {
      requireAccess(context, args.restaurantId);
      const reservation = reservations.find((r) => r.id === args.reservationId && r.restaurantId === args.restaurantId);
      if (!reservation) notFound("Reservation not found.");
      if (reservation.state === "CANCELLED") {
        badUserInput("Cannot change the state of a cancelled reservation.", "state");
      }
      const now = new Date().toISOString();
      reservation.state = args.state;
      reservation.checkedInAt = args.state === "CHECKED_IN" ? now : null;
      reservation.notAppearedAt = args.state === "NOT_APPEARED" ? now : null;
      return reservation;
    },
    addAvailability: (
      _: unknown,
      args: {
        input: {
          restaurantId: string;
          date: string;
          session: Session;
          times: string[];
          limitBy?: CapacityLimit;
          tables: number;
          paxAvailable?: number;
          partySizes?: string;
        };
      },
      context: RequestContext,
    ) => {
      const { input } = args;
      requireRole(context, input.restaurantId, "MANAGER");
      if (input.tables <= 0) badUserInput("tables must be greater than zero.", "input.tables");
      const limitBy = input.limitBy ?? "TABLES";
      if ((limitBy === "PAX" || limitBy === "BOTH") && input.paxAvailable == null) {
        badUserInput("paxAvailable is required when limitBy is PAX or BOTH.", "input.paxAvailable");
      }
      const created = input.times.map((time) => {
        const slot: AvailabilitySlot = {
          id: String(nextSlotSeq++),
          restaurantId: input.restaurantId,
          date: input.date,
          time,
          session: input.session,
          limitBy,
          tablesAvailable: input.tables,
          tablesSold: 0,
          paxAvailable: input.paxAvailable ?? 0,
          paxSold: 0,
          partySizes: input.partySizes ?? null,
          price: null,
          discount: null,
          locked: false,
        };
        return slot;
      });
      availabilitySlots = [...availabilitySlots, ...created];
      return created.sort((a, b) => a.time.localeCompare(b.time));
    },
    addTables: (
      _: unknown,
      args: { input: { restaurantId: string; availabilityId: string; tables: number } },
      context: RequestContext,
    ) => {
      const { input } = args;
      requireRole(context, input.restaurantId, "MANAGER");
      if (input.tables <= 0) badUserInput("tables must be greater than zero.", "input.tables");
      const slot = availabilitySlots.find((s) => s.id === input.availabilityId && s.restaurantId === input.restaurantId);
      if (!slot) notFound("Availability slot not found.");
      if (slot.locked) slotLocked(slot.id);
      slot.tablesAvailable += input.tables;
      return slot;
    },
  },
};

export const restaurantSchema = createSchema({ typeDefs, resolvers });

export function resolveCurrentUser(authorizationHeader: string | null): MockUser | undefined {
  if (!authorizationHeader) return undefined;
  const token = authorizationHeader.replace(/^Bearer\s+/i, "").trim();
  return findUserByToken(token);
}
