"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { RestaurantIdLookup } from "@/components/restaurant-id-lookup";
import { getErrorMessage } from "@/lib/apollo-client";
import { useSelectedRestaurant } from "@/lib/use-selected-restaurant";

// Dates are plain "YYYY-MM-DD" strings in the browser's local time (the real
// API takes String, not a Date scalar). Local, not toISOString(): that's UTC,
// which in NZ is still yesterday until midday.
function toDateString(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateString(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return toDateString(date) === value ? date : null;
}

function addDays(date: string, days: number) {
  const d = parseDateString(date)!;
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

function todayString() {
  return toDateString(new Date());
}

const WEEK_DAYS = 7;

// How far back staff can still check in / mark no-show / undo — enough to
// tidy up last night, without rewriting old no-show history. App-side only:
// the backend accepts state changes on any date.
const EDIT_WINDOW_DAYS = 7;

// The viewed week lives in ?from=YYYY-MM-DD so a specific week is a shareable
// link; no param means the week starting today.
function useWeek() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = todayString();
  const from = parseDateString(searchParams.get("from")) ? searchParams.get("from")! : today;

  function setFrom(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === today) params.delete("from");
    else params.set("from", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return { today, from, to: addDays(from, WEEK_DAYS - 1), setFrom };
}

function WeekNav({ today, from, to, setFrom }: ReturnType<typeof useWeek>) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => setFrom(addDays(from, -WEEK_DAYS))}>
        ← Previous week
      </Button>
      <Button size="sm" variant={from === today ? "default" : "outline"} onClick={() => setFrom(today)}>
        Today
      </Button>
      <Button size="sm" variant="outline" onClick={() => setFrom(addDays(from, WEEK_DAYS))}>
        Next week →
      </Button>
      <Input
        type="date"
        aria-label="Jump to date"
        value={from}
        onChange={(e) => parseDateString(e.target.value) && setFrom(e.target.value)}
        className="h-8 w-40"
      />
      <span className="text-muted-foreground text-sm">
        {from} – {to}
      </span>
    </div>
  );
}

const RESERVATIONS_QUERY = gql`
  query Reservations($restaurantId: Int!, $from: String!, $to: String) {
    reservations(restaurantId: $restaurantId, from: $from, to: $to) {
      id
      guestName
      date
      time
      partySize
      state
      dietaryRequirements
      firstVisit
    }
  }
`;

const SCHEDULE_QUERY = gql`
  query Schedule($restaurantId: Int!, $from: String!, $to: String!) {
    schedule(restaurantId: $restaurantId, from: $from, to: $to) {
      date
      isClosed
      tablesAvailable
      tablesSold
      slots {
        id
        time
        session
        limitBy
        tablesAvailable
        tablesSold
        paxAvailable
        paxSold
        partySizes
        locked
      }
    }
  }
`;

const CHANGE_STATE_MUTATION = gql`
  mutation ChangeReservationState($restaurantId: Int!, $reservationId: Int!, $state: ReservationStateChange!) {
    changeReservationState(restaurantId: $restaurantId, reservationId: $reservationId, state: $state) {
      id
      state
    }
  }
`;

const ADD_AVAILABILITY_MUTATION = gql`
  mutation AddAvailability($input: AddAvailabilityInput!) {
    addAvailability(input: $input) {
      id
    }
  }
`;

const ADD_TABLES_MUTATION = gql`
  mutation AddTables($input: AddTablesInput!) {
    addTables(input: $input) {
      id
      tablesAvailable
      locked
    }
  }
`;

type ReservationState = "BOOKED" | "CHECKED_IN" | "NOT_APPEARED" | "CANCELLED";

interface Reservation {
  id: number;
  guestName: string;
  date: string;
  time: string;
  partySize: number;
  state: ReservationState;
  dietaryRequirements: string | null;
  firstVisit: boolean;
}

type CapacityLimit = "TABLES" | "PAX" | "BOTH";

interface AvailabilitySlot {
  id: number;
  time: string;
  session: string;
  limitBy: CapacityLimit;
  tablesAvailable: number;
  tablesSold: number;
  paxAvailable: number;
  paxSold: number;
  partySizes: string | null;
  locked: boolean;
}

interface ScheduleDay {
  date: string;
  isClosed: boolean;
  tablesAvailable: number;
  tablesSold: number;
  slots: AvailabilitySlot[];
}

const stateVariant: Record<ReservationState, "default" | "secondary" | "outline"> = {
  BOOKED: "outline",
  CHECKED_IN: "default",
  NOT_APPEARED: "secondary",
  CANCELLED: "secondary",
};

function formatTimeOfDay(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")}${period}`;
}

// limitBy says which pair of numbers actually constrains the slot — show
// only what's relevant rather than always defaulting to the tables pair.
function formatCapacity(slot: AvailabilitySlot) {
  const parts: string[] = [];
  if (slot.limitBy === "TABLES" || slot.limitBy === "BOTH") {
    parts.push(`${slot.tablesAvailable} tables left / ${slot.tablesSold} sold`);
  }
  if (slot.limitBy === "PAX" || slot.limitBy === "BOTH") {
    parts.push(`${slot.paxAvailable} pax left / ${slot.paxSold} sold`);
  }
  return parts.join(" · ");
}

function AddAvailabilityDialog({ restaurantId, onDone }: { restaurantId: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayString);
  const [session, setSession] = useState("DINNER");
  const [times, setTimes] = useState("19:00:00");
  const [tables, setTables] = useState("2");
  const [error, setError] = useState<string | null>(null);
  const [addAvailability, { loading }] = useMutation(ADD_AVAILABILITY_MUTATION);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addAvailability({
        variables: {
          input: {
            restaurantId,
            date,
            session,
            times: times.split(",").map((t) => t.trim()),
            limitBy: "TABLES",
            tables: Number(tables),
          },
        },
      });
      setOpen(false);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Add availability</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add availability</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="av-date">Date</Label>
            <Input id="av-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Session</Label>
            <Select value={session} onValueChange={setSession}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BREAKFAST">Breakfast</SelectItem>
                <SelectItem value="LUNCH">Lunch</SelectItem>
                <SelectItem value="DINNER">Dinner</SelectItem>
                <SelectItem value="DINNER2">Dinner 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="av-times">Times (comma-separated, HH:mm:ss)</Label>
            <Input id="av-times" value={times} onChange={(e) => setTimes(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="av-tables">Tables per slot</Label>
            <Input id="av-tables" type="number" min={1} value={tables} onChange={(e) => setTables(e.target.value)} required />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Adding…" : "Add availability"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// useSearchParams needs a Suspense boundary or Next bails out of static
// rendering for the whole page at build time.
export function DashboardContent() {
  return (
    <Suspense>
      <DashboardContentInner />
    </Suspense>
  );
}

function DashboardContentInner() {
  const week = useWeek();
  const editableFrom = addDays(week.today, -EDIT_WINDOW_DAYS);
  const { user, loading: userLoading, restaurantId, access, lookupLoading, lookupError } =
    useSelectedRestaurant();
  const role = access?.role;

  const reservationsQuery = useQuery<{ reservations: Reservation[] }>(RESERVATIONS_QUERY, {
    variables: { restaurantId, from: week.from, to: week.to },
    skip: !restaurantId,
  });
  const scheduleQuery = useQuery<{ schedule: ScheduleDay[] }>(SCHEDULE_QUERY, {
    variables: { restaurantId, from: week.from, to: week.to },
    skip: !restaurantId,
    // Without this, .loading stays false during refetch() and the "Loading…"
    // state never shows after adding tables/availability.
    notifyOnNetworkStatusChange: true,
  });

  const [changeState, { loading: changeStateLoading }] = useMutation(CHANGE_STATE_MUTATION);
  const [addTables, { loading: addTablesLoading }] = useMutation(ADD_TABLES_MUTATION);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingReservation, setPendingReservation] = useState<{ id: number; state: string } | null>(null);
  const [pendingSlotId, setPendingSlotId] = useState<number | null>(null);

  async function handleChangeState(reservationId: number, state: string) {
    if (changeStateLoading) return; // already mid-flight — ignore a repeat click
    setActionError(null);
    setPendingReservation({ id: reservationId, state });
    try {
      await changeState({ variables: { restaurantId, reservationId, state } });
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setPendingReservation(null);
    }
  }

  async function handleAddTable(availabilityId: number) {
    if (addTablesLoading) return;
    setActionError(null);
    setPendingSlotId(availabilityId);
    try {
      await addTables({ variables: { input: { restaurantId, availabilityId, tables: 1 } } });
      scheduleQuery.refetch();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setPendingSlotId(null);
    }
  }

  if (!userLoading && !user) {
    return (
      <main className="mx-auto max-w-4xl w-full p-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-sm">
              Log in from the top right to view the dashboard.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (user?.isInternalAdmin && (restaurantId == null || !access)) {
    return (
      <main className="mx-auto max-w-4xl w-full p-8">
        <Card>
          <CardContent className="p-6 flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              {user.email} is a FirstTable admin, so it isn&apos;t mapped to restaurants — it
              can open any one by ID.
            </p>
            <RestaurantIdLookup />
            {lookupLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
            {lookupError && (
              <p className="text-destructive text-sm">
                Restaurant {restaurantId}: {getErrorMessage(lookupError)}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (user && !user.isInternalAdmin && user.access.length === 0) {
    return (
      <main className="mx-auto max-w-4xl w-full p-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-sm">
              {user.email} isn&apos;t mapped to any restaurant. Nothing to show here —
              this is a backend-side access mapping, not something this app can fix.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl w-full p-8">
      <Card>
        <CardHeader>
          <CardTitle>{access?.restaurant.title ?? "Restaurant Dashboard"}</CardTitle>
        </CardHeader>
        <CardContent>
          {actionError && <p className="text-destructive text-sm mb-3">{actionError}</p>}

          <WeekNav {...week} />

          <Tabs defaultValue="reservations">
            <TabsList>
              <TabsTrigger value="reservations">Reservations</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>

            <TabsContent value="reservations">
              {reservationsQuery.loading && <p className="text-muted-foreground text-sm">Loading…</p>}
              {reservationsQuery.error && (
                <p className="text-destructive text-sm">{getErrorMessage(reservationsQuery.error)}</p>
              )}
              {reservationsQuery.data && reservationsQuery.data.reservations.length === 0 && (
                <p className="text-muted-foreground text-sm">No reservations this week.</p>
              )}
              {reservationsQuery.data && reservationsQuery.data.reservations.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Party</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservationsQuery.data.reservations.map((r) => {
                      const isPending = pendingReservation?.id === r.id;
                      const editable = r.date >= editableFrom;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{r.guestName}{r.firstVisit && <span className="text-muted-foreground text-xs"> (first visit)</span>}</TableCell>
                          <TableCell>{r.partySize}</TableCell>
                          <TableCell>{r.date}</TableCell>
                          <TableCell>{formatTimeOfDay(r.time)}</TableCell>
                          <TableCell>
                            <Badge variant={stateVariant[r.state]}>{r.state}</Badge>
                          </TableCell>
                          <TableCell className="flex gap-2 justify-end">
                            {r.state === "CANCELLED" ? null : !editable ? (
                              <span
                                className="text-muted-foreground text-xs"
                                title={`Reservations older than ${EDIT_WINDOW_DAYS} days can't be changed`}
                              >
                                Read-only
                              </span>
                            ) : r.state === "BOOKED" ? (
                              <>
                                <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleChangeState(r.id, "CHECKED_IN")}>
                                  {isPending && pendingReservation?.state === "CHECKED_IN" ? "Checking in…" : "Check in"}
                                </Button>
                                <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleChangeState(r.id, "NOT_APPEARED")}>
                                  {isPending && pendingReservation?.state === "NOT_APPEARED" ? "Marking…" : "No-show"}
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleChangeState(r.id, "BOOKED")}>
                                {isPending ? "Undoing…" : "Undo"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="schedule">
              {role === "MANAGER" && restaurantId && (
                <div className="mb-3 flex justify-end">
                  <AddAvailabilityDialog restaurantId={restaurantId} onDone={() => scheduleQuery.refetch()} />
                </div>
              )}
              {scheduleQuery.loading && <p className="text-muted-foreground text-sm">Loading…</p>}
              {scheduleQuery.error && (
                <p className="text-destructive text-sm">{getErrorMessage(scheduleQuery.error)}</p>
              )}
              {scheduleQuery.data && (
                <div className="flex flex-col gap-4">
                  {scheduleQuery.data.schedule.map((day) => (
                    <div key={day.date}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{day.date}</span>
                        {day.isClosed && <Badge variant="secondary">Closed</Badge>}
                      </div>
                      {!day.isClosed && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Time</TableHead>
                              <TableHead>Session</TableHead>
                              <TableHead>Capacity</TableHead>
                              <TableHead>Party sizes</TableHead>
                              <TableHead />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {day.slots.map((slot) => (
                              <TableRow key={slot.id}>
                                <TableCell>{formatTimeOfDay(slot.time)}</TableCell>
                                <TableCell>{slot.session}</TableCell>
                                <TableCell>
                                  {formatCapacity(slot)}
                                  {slot.locked && <Badge variant="secondary" className="ml-2">Locked</Badge>}
                                </TableCell>
                                <TableCell>{slot.partySizes ?? "—"}</TableCell>
                                <TableCell className="text-right">
                                  {role === "MANAGER" && day.date >= week.today && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={slot.locked || pendingSlotId === slot.id}
                                      title={slot.locked ? "Locked slots can't be changed from this app" : undefined}
                                      onClick={() => handleAddTable(slot.id)}
                                    >
                                      {pendingSlotId === slot.id ? "Adding…" : "+1 table"}
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
