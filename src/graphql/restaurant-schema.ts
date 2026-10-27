import { createSchema, createGraphQLError } from "graphql-yoga";
import { GraphQLScalarType, Kind } from "graphql";
import { restaurants, findUserByToken, type MockUser, type Session } from "@/graphql/mock-users";

// Mock of the proposed /restaurant-graphql endpoint (PD-6967 handover).
// Auth: Application-Authorization: Bearer <token>, token from createToken
// on the public schema. V1 has one access level: any listed restaurant
// (currentUser.restaurantIds) gets every operation.

export interface RequestContext {
  currentUser?: MockUser;
}

type ReservationState = "BOOKED" | "NOT_APPEARED" | "CANCELLED";
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
  { id: "9001", restaurantId: "101", reference: "FT8K2QDX", guestName: "Priya Nair", phone: "+64 21 555 0143", date: "2026-10-04", time: "18:00:00", dateTimeUTC: "2026-10-04T05:00:00Z", session: "DINNER", partySize: 2, state: "BOOKED", dietaryRequirements: "One gluten free", comments: "Anniversary — window table if possible", firstVisit: true },
  { id: "9002", restaurantId: "101", reference: "FT4M7PLA", guestName: "Tom Whitaker", phone: "+64 27 555 0918", date: "2026-10-04", time: "18:15:00", dateTimeUTC: "2026-10-04T05:15:00Z", session: "DINNER", partySize: 4, state: "BOOKED", dietaryRequirements: null, comments: null, firstVisit: false },
  { id: "9003", restaurantId: "101", reference: "FT1Z9RBN", guestName: "Mei Lin", phone: "+64 22 555 0277", date: "2026-10-04", time: "18:30:00", dateTimeUTC: "2026-10-04T05:30:00Z", session: "DINNER", partySize: 2, state: "NOT_APPEARED", dietaryRequirements: null, comments: null, firstVisit: true },
  { id: "9004", restaurantId: "101", reference: "FT6Q3WKE", guestName: "Daniel Osei", phone: "+64 21 555 0466", date: "2026-10-05", time: "12:00:00", dateTimeUTC: "2026-10-04T23:00:00Z", session: "LUNCH", partySize: 3, state: "BOOKED", dietaryRequirements: "Nut allergy", comments: null, firstVisit: false },
  { id: "9005", restaurantId: "101", reference: "FT2H8VCT", guestName: "Ellie Barnes", phone: null, date: "2026-10-05", time: "18:00:00", dateTimeUTC: "2026-10-05T05:00:00Z", session: "DINNER", partySize: 6, state: "CANCELLED", dietaryRequirements: null, comments: null, firstVisit: false },
  { id: "9101", restaurantId: "103", reference: "FT5R1NDQ", guestName: "Jonah Patel", phone: "+64 21 555 0788", date: "2026-10-04", time: "19:00:00", dateTimeUTC: "2026-10-04T06:00:00Z", session: "DINNER", partySize: 2, state: "BOOKED", dietaryRequirements: null, comments: null, firstVisit: true },
  { id: "9201", restaurantId: "102", reference: "FT9L4XKM", guestName: "Harriet Cole", phone: "+64 21 555 0512", date: "2026-10-04", time: "19:00:00", dateTimeUTC: "2026-10-04T06:00:00Z", session: "DINNER", partySize: 2, state: "BOOKED", dietaryRequirements: null, comments: null, firstVisit: false },
  { id: "9202", restaurantId: "102", reference: "FT3P7HDW", guestName: "Marcus Webb", phone: "+64 27 555 0364", date: "2026-10-04", time: "19:30:00", dateTimeUTC: "2026-10-04T06:30:00Z", session: "DINNER", partySize: 5, state: "BOOKED", dietaryRequirements: "Vegetarian x2", comments: "Birthday", firstVisit: true },
  { id: "9203", restaurantId: "102", reference: "FT6V2QRS", guestName: "Nina Patel", phone: null, date: "2026-10-05", time: "19:00:00", dateTimeUTC: "2026-10-05T06:00:00Z", session: "DINNER", partySize: 3, state: "BOOKED", dietaryRequirements: null, comments: null, firstVisit: false },
];

let availabilitySlots: AvailabilitySlot[] = [
  { id: "5001", restaurantId: "101", date: "2026-10-04", time: "18:00:00", session: "DINNER", limitBy: "TABLES", tablesAvailable: 1, tablesSold: 1, paxAvailable: 0, paxSold: 2, partySizes: "2,3,4", price: "25.00", discount: 0.5, locked: false },
  { id: "5002", restaurantId: "101", date: "2026-10-04", time: "18:15:00", session: "DINNER", limitBy: "TABLES", tablesAvailable: 0, tablesSold: 1, paxAvailable: 0, paxSold: 4, partySizes: "2,3,4", price: "25.00", discount: 0.5, locked: false },
  { id: "5003", restaurantId: "101", date: "2026-10-04", time: "18:30:00", session: "DINNER", limitBy: "TABLES", tablesAvailable: 2, tablesSold: 1, paxAvailable: 0, paxSold: 2, partySizes: "2,3,4", price: "25.00", discount: 0.5, locked: true },
  { id: "5004", restaurantId: "101", date: "2026-10-05", time: "12:00:00", session: "LUNCH", limitBy: "TABLES", tablesAvailable: 4, tablesSold: 1, paxAvailable: 0, paxSold: 3, partySizes: "2,3,4", price: "20.00", discount: 0.5, locked: false },
  { id: "5005", restaurantId: "102", date: "2026-10-04", time: "19:00:00", session: "DINNER", limitBy: "TABLES", tablesAvailable: 2, tablesSold: 2, paxAvailable: 0, paxSold: 7, partySizes: "2,3,4,5", price: "22.00", discount: 0.5, locked: false },
  { id: "5006", restaurantId: "102", date: "2026-10-05", time: "19:00:00", session: "DINNER", limitBy: "TABLES", tablesAvailable: 3, tablesSold: 1, paxAvailable: 0, paxSold: 3, partySizes: "2,3,4,5", price: "22.00", discount: 0.5, locked: false },
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

function forbiddenPaxLimit(): never {
  throw createGraphQLError(
    'Limiting by pax or choosing party sizes needs the "Limit availability by pax" permission.',
    { extensions: { code: "FORBIDDEN", http: { status: 403 } } },
  );
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

// The dashboard asks for one week. schedule() builds one ScheduleDay per UTC
// date, synchronously, so a wider span has to be rejected before that loop.
const MAX_SCHEDULE_DAYS = 7;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseScheduleDate(value: string, field: "from" | "to"): Date {
  // Four-digit year only: a leading sign or expanded year (Date.parse accepts
  // both, out to the ECMAScript limits) must not reach the day loop.
  if (typeof value !== "string" || !CALENDAR_DATE.test(value)) {
    badUserInput("Date must be YYYY-MM-DD.", field);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  // Date.parse overflows impossible days (2026-02-31) into a neighboring date.
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    badUserInput("Date must be a real calendar day.", field);
  }
  return parsed;
}

function scheduleDates(fromRaw: string, toRaw: string): string[] {
  const from = parseScheduleDate(fromRaw, "from");
  const to = parseScheduleDate(toRaw, "to");
  if (from > to) badUserInput("from must be on or before to.", "from");
  const spanDays = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
  if (spanDays > MAX_SCHEDULE_DAYS) {
    badUserInput(`Date range cannot exceed ${MAX_SCHEDULE_DAYS} days.`, "to");
  }
  const days: string[] = [];
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function requireAuth(context: RequestContext): MockUser {
  if (!context.currentUser) unauthenticated();
  return context.currentUser;
}

function requireAccess(context: RequestContext, restaurantId: string) {
  const user = requireAuth(context);
  if (!user.restaurantIds.includes(restaurantId)) forbiddenRestaurant(restaurantId);
  return user;
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

  enum Session {
    BREAKFAST
    LUNCH
    DINNER
    DINNER2
  }

  enum ReservationState {
    BOOKED
    NOT_APPEARED
    CANCELLED
  }

  enum ReservationStateChange {
    BOOKED
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
    isInternalAdmin: Boolean!
    restaurants: [Restaurant!]!
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

  RestaurantUser: {
    isInternalAdmin: () => false,
    restaurants: (user: MockUser) => restaurants.filter((r) => user.restaurantIds.includes(r.id)),
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
      const days = scheduleDates(args.from, args.to);
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
      args: { restaurantId: string; reservationId: string; state: "BOOKED" | "NOT_APPEARED" },
      context: RequestContext,
    ) => {
      requireAccess(context, args.restaurantId);
      const reservation = reservations.find((r) => r.id === args.reservationId && r.restaurantId === args.restaurantId);
      if (!reservation) notFound("Reservation not found.");
      if (reservation.state === "CANCELLED") {
        badUserInput("Cannot change the state of a cancelled reservation.", "state");
      }
      reservation.state = args.state;
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
      const user = requireAccess(context, input.restaurantId);
      if (input.tables <= 0) badUserInput("tables must be greater than zero.", "input.tables");
      const usesPax =
        input.limitBy === "PAX" || input.limitBy === "BOTH" || input.paxAvailable != null || input.partySizes != null;
      if (usesPax && !user.canLimitByPax) forbiddenPaxLimit();
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
      requireAccess(context, input.restaurantId);
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
