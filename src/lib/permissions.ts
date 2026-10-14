// Feature permissions a role can hold at one restaurant (backend
// RestaurantPermission enum). The app gates every feature on these, never on
// the role's name — venues can create and rename their own roles.
export const PERMISSIONS = [
  "VIEW_RESERVATIONS",
  "CHANGE_RESERVATION_STATE",
  "VIEW_SCHEDULE",
  "ADD_AVAILABILITY",
  "ADD_TABLES",
  "MANAGE_TEAM",
  "MANAGE_ROLES",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_INFO: Record<Permission, { label: string; description: string }> = {
  VIEW_RESERVATIONS: {
    label: "View reservations",
    description: "See the reservation list and guest details.",
  },
  CHANGE_RESERVATION_STATE: {
    label: "Check in & no-show",
    description: "Check guests in, mark no-shows, and undo either.",
  },
  VIEW_SCHEDULE: {
    label: "View schedule",
    description: "See availability slots and how many tables are sold.",
  },
  ADD_AVAILABILITY: {
    label: "Add availability",
    description: "Open new time slots for booking.",
  },
  ADD_TABLES: {
    label: "Add tables",
    description: "Add tables to an existing slot.",
  },
  MANAGE_TEAM: {
    label: "Manage team",
    description: "Add and remove team members, change their roles, and see team activity.",
  },
  MANAGE_ROLES: {
    label: "Manage roles",
    description: "Create, edit and delete this restaurant's roles.",
  },
};

// The Owner role always keeps these, so a restaurant can't lock itself out
// of managing its own team.
export const OWNER_LOCKED_PERMISSIONS: Permission[] = ["MANAGE_TEAM", "MANAGE_ROLES"];
