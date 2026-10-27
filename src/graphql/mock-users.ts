// Shared read-only fixtures for both mock endpoints (public login + restaurant
// API), matching the PD-6967 handover's mock-data.json.

export type Session = "BREAKFAST" | "LUNCH" | "DINNER" | "DINNER2";

export interface Restaurant {
  id: string;
  title: string;
  city: string;
  timezone: string;
  currency: string;
  sessions: Session[];
}

export interface MockUser {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  password: string;
  token: string;
  restaurantIds: string[];
  // The "Limit availability by pax" permission (AVAILABILITY_LIMIT_BY_PAX).
  canLimitByPax: boolean;
}

export const restaurants: Restaurant[] = [
  { id: "101", title: "Cafe Hana", city: "Auckland", timezone: "Pacific/Auckland", currency: "NZD", sessions: ["LUNCH", "DINNER"] },
  { id: "102", title: "Bistro Lune", city: "Auckland", timezone: "Pacific/Auckland", currency: "NZD", sessions: ["DINNER"] },
  { id: "103", title: "Pier Nine", city: "Wellington", timezone: "Pacific/Auckland", currency: "NZD", sessions: ["DINNER"] },
];

export const users: MockUser[] = [
  {
    id: "1",
    firstName: "Aroha",
    surname: "Kelly",
    email: "manager@example.com",
    password: "password",
    token: "mock.jwt.user1",
    restaurantIds: ["101", "102"],
    canLimitByPax: true,
  },
  {
    id: "2",
    firstName: "Sam",
    surname: "Tuala",
    email: "staff@example.com",
    password: "password",
    token: "mock.jwt.user2",
    restaurantIds: ["103"],
    canLimitByPax: false,
  },
];

export function findUserByToken(token: string): MockUser | undefined {
  return users.find((u) => u.token === token);
}

export function findUserByCredentials(email: string, password: string): MockUser | undefined {
  return users.find((u) => u.email === email && u.password === password);
}
