import { createSchema } from "graphql-yoga";

// Domain model for PD-6967: restaurant-scoped staff/manager operations
// (reservations check-in/no-show, schedule/availability, tables).
// In-memory seed data — no auth/authorization yet, just the data shape.

export type StaffRole = "STAFF" | "MANAGER";
export type ReservationStatus = "UPCOMING" | "CHECKED_IN" | "NOT_APPEARED";
export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export interface Restaurant {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  restaurantIds: string[];
}

export interface Reservation {
  id: string;
  restaurantId: string;
  dinerName: string;
  partySize: number;
  time: string; // ISO 8601
  status: ReservationStatus;
}

// The restaurant's recurring seating schedule: Staff read it, Manager adds
// to it via addAvailability. Each row is a bookable slot — a day pattern +
// time with a table/diner allotment.
export interface AvailabilitySlot {
  id: string;
  restaurantId: string;
  daysOfWeek: Weekday[];
  time: string; // 24h "HH:mm"
  tables: number;
  minDiners: number;
  maxDiners: number;
}

export interface Table {
  id: string;
  restaurantId: string;
  name: string;
  capacity: number;
}

const restaurants: Restaurant[] = [
  { id: "r1", name: "The Garden Shed" },
  { id: "r2", name: "Kingsview Grill" },
];

const users: User[] = [
  { id: "u1", name: "Alex Rivera", email: "alex@example.com", role: "STAFF", restaurantIds: ["r1"] },
  { id: "u2", name: "Jamie Chen", email: "jamie@example.com", role: "MANAGER", restaurantIds: ["r1", "r2"] },
];

let reservations: Reservation[] = [
  { id: "res1", restaurantId: "r1", dinerName: "Sam Taylor", partySize: 2, time: "2026-09-24T18:30:00+10:00", status: "UPCOMING" },
  { id: "res2", restaurantId: "r1", dinerName: "Priya Nair", partySize: 4, time: "2026-09-24T19:00:00+10:00", status: "UPCOMING" },
  { id: "res3", restaurantId: "r1", dinerName: "Chris Lee", partySize: 3, time: "2026-09-24T19:15:00+10:00", status: "CHECKED_IN" },
  { id: "res4", restaurantId: "r2", dinerName: "Morgan Blake", partySize: 2, time: "2026-09-24T20:00:00+10:00", status: "UPCOMING" },
];

let availabilitySlots: AvailabilitySlot[] = [
  { id: "av1", restaurantId: "r1", daysOfWeek: ["MON", "TUE", "WED", "THU"], time: "20:00", tables: 6, minDiners: 1, maxDiners: 6 },
  { id: "av2", restaurantId: "r1", daysOfWeek: ["SUN"], time: "20:00", tables: 6, minDiners: 1, maxDiners: 6 },
  { id: "av3", restaurantId: "r1", daysOfWeek: ["FRI", "SAT"], time: "17:30", tables: 5, minDiners: 2, maxDiners: 4 },
  { id: "av4", restaurantId: "r1", daysOfWeek: ["FRI", "SAT"], time: "19:00", tables: 4, minDiners: 2, maxDiners: 4 },
  { id: "av5", restaurantId: "r1", daysOfWeek: ["FRI", "SAT"], time: "19:30", tables: 4, minDiners: 2, maxDiners: 4 },
];

let tables: Table[] = [
  { id: "t1", restaurantId: "r1", name: "T1", capacity: 2 },
  { id: "t2", restaurantId: "r1", name: "T2", capacity: 4 },
];

let nextId = 100;

const typeDefs = /* GraphQL */ `
  enum StaffRole {
    STAFF
    MANAGER
  }

  enum ReservationStatus {
    UPCOMING
    CHECKED_IN
    NOT_APPEARED
  }

  enum Weekday {
    MON
    TUE
    WED
    THU
    FRI
    SAT
    SUN
  }

  type Restaurant {
    id: ID!
    name: String!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: StaffRole!
    restaurants: [Restaurant!]!
  }

  type Reservation {
    id: ID!
    restaurantId: ID!
    dinerName: String!
    partySize: Int!
    time: String!
    status: ReservationStatus!
  }

  type AvailabilitySlot {
    id: ID!
    restaurantId: ID!
    daysOfWeek: [Weekday!]!
    time: String!
    tables: Int!
    minDiners: Int!
    maxDiners: Int!
  }

  type Table {
    id: ID!
    restaurantId: ID!
    name: String!
    capacity: Int!
  }

  type Query {
    restaurants: [Restaurant!]!
    users: [User!]!
    reservations(restaurantId: ID!): [Reservation!]!
    schedule(restaurantId: ID!): [AvailabilitySlot!]!
    tables(restaurantId: ID!): [Table!]!
  }

  type Mutation {
    checkInReservation(id: ID!): Reservation!
    markNotAppeared(id: ID!): Reservation!
    addAvailability(
      restaurantId: ID!
      daysOfWeek: [Weekday!]!
      time: String!
      tables: Int!
      minDiners: Int!
      maxDiners: Int!
    ): AvailabilitySlot!
    addTable(restaurantId: ID!, name: String!, capacity: Int!): Table!
  }
`;

function findReservation(id: string): Reservation {
  const reservation = reservations.find((r) => r.id === id);
  if (!reservation) throw new Error(`Reservation ${id} not found`);
  return reservation;
}

const resolvers = {
  User: {
    restaurants: (user: User) =>
      restaurants.filter((r) => user.restaurantIds.includes(r.id)),
  },
  Query: {
    restaurants: () => restaurants,
    users: () => users,
    reservations: (_: unknown, args: { restaurantId: string }) =>
      reservations.filter((r) => r.restaurantId === args.restaurantId),
    schedule: (_: unknown, args: { restaurantId: string }) =>
      availabilitySlots.filter((a) => a.restaurantId === args.restaurantId),
    tables: (_: unknown, args: { restaurantId: string }) =>
      tables.filter((t) => t.restaurantId === args.restaurantId),
  },
  Mutation: {
    checkInReservation: (_: unknown, args: { id: string }) => {
      const reservation = findReservation(args.id);
      reservation.status = "CHECKED_IN";
      return reservation;
    },
    markNotAppeared: (_: unknown, args: { id: string }) => {
      const reservation = findReservation(args.id);
      reservation.status = "NOT_APPEARED";
      return reservation;
    },
    addAvailability: (
      _: unknown,
      args: {
        restaurantId: string;
        daysOfWeek: Weekday[];
        time: string;
        tables: number;
        minDiners: number;
        maxDiners: number;
      },
    ) => {
      const entry: AvailabilitySlot = { id: `av${nextId++}`, ...args };
      availabilitySlots = [...availabilitySlots, entry];
      return entry;
    },
    addTable: (
      _: unknown,
      args: { restaurantId: string; name: string; capacity: number },
    ) => {
      const table: Table = { id: `t${nextId++}`, ...args };
      tables = [...tables, table];
      return table;
    },
  },
};

export const schema = createSchema({ typeDefs, resolvers });
