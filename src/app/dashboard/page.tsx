"use client";

import { useState } from "react";
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
import { getErrorMessage } from "@/lib/apollo-client";
import { useSelectedRestaurant } from "@/lib/use-selected-restaurant";

// A week starting today, in the restaurant's local date terms (plain
// "YYYY-MM-DD" strings — the real API takes String, not a Date scalar).
function toDateString(d: Date) {
  return d.toISOString().slice(0, 10);
}
const TODAY = new Date();
const FROM = toDateString(TODAY);
const TO = toDateString(new Date(TODAY.getTime() + 6 * 24 * 60 * 60 * 1000));

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
  const [date, setDate] = useState(FROM);
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

export default function DashboardPage() {
  const { user, loading: userLoading, restaurantId, access } = useSelectedRestaurant();
  const role = access?.role;

  const reservationsQuery = useQuery<{ reservations: Reservation[] }>(RESERVATIONS_QUERY, {
    variables: { restaurantId, from: FROM, to: TO },
    skip: !restaurantId,
  });
  const scheduleQuery = useQuery<{ schedule: ScheduleDay[] }>(SCHEDULE_QUERY, {
    variables: { restaurantId, from: FROM, to: TO },
    skip: !restaurantId,
  });

  const [changeState] = useMutation(CHANGE_STATE_MUTATION);
  const [addTables] = useMutation(ADD_TABLES_MUTATION);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleChangeState(reservationId: number, state: string) {
    setActionError(null);
    try {
      await changeState({ variables: { restaurantId, reservationId, state } });
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  async function handleAddTable(availabilityId: number) {
    setActionError(null);
    try {
      await addTables({ variables: { input: { restaurantId, availabilityId, tables: 1 } } });
      scheduleQuery.refetch();
    } catch (err) {
      setActionError(getErrorMessage(err));
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

  return (
    <main className="mx-auto max-w-4xl w-full p-8">
      <Card>
        <CardHeader>
          <CardTitle>{access?.restaurant.title ?? "Restaurant Dashboard"}</CardTitle>
        </CardHeader>
        <CardContent>
          {actionError && <p className="text-destructive text-sm mb-3">{actionError}</p>}

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
              {reservationsQuery.data && (
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
                    {reservationsQuery.data.reservations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.guestName}{r.firstVisit && <span className="text-muted-foreground text-xs"> (first visit)</span>}</TableCell>
                        <TableCell>{r.partySize}</TableCell>
                        <TableCell>{r.date}</TableCell>
                        <TableCell>{formatTimeOfDay(r.time)}</TableCell>
                        <TableCell>
                          <Badge variant={stateVariant[r.state]}>{r.state}</Badge>
                        </TableCell>
                        <TableCell className="flex gap-2 justify-end">
                          {r.state === "CANCELLED" ? null : r.state === "BOOKED" ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleChangeState(r.id, "CHECKED_IN")}>
                                Check in
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleChangeState(r.id, "NOT_APPEARED")}>
                                No-show
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => handleChangeState(r.id, "BOOKED")}>
                              Undo
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
                                  {role === "MANAGER" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={slot.locked}
                                      title={slot.locked ? "Locked slots can't be changed from this app" : undefined}
                                      onClick={() => handleAddTable(slot.id)}
                                    >
                                      +1 table
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
