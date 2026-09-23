"use client";

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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// Demo restaurant — a real build would derive this from the signed-in
// user's authorized restaurant(s) instead of hardcoding it.
const RESTAURANT_ID = "r1";

const DASHBOARD_QUERY = gql`
  query Dashboard($restaurantId: ID!) {
    reservations(restaurantId: $restaurantId) {
      id
      dinerName
      partySize
      time
      status
    }
    schedule(restaurantId: $restaurantId) {
      id
      daysOfWeek
      time
      tables
      minDiners
      maxDiners
    }
    tables(restaurantId: $restaurantId) {
      id
      name
      capacity
    }
  }
`;

const CHECK_IN_MUTATION = gql`
  mutation CheckIn($id: ID!) {
    checkInReservation(id: $id) {
      id
      status
    }
  }
`;

const NOT_APPEARED_MUTATION = gql`
  mutation NotAppeared($id: ID!) {
    markNotAppeared(id: $id) {
      id
      status
    }
  }
`;

interface Reservation {
  id: string;
  dinerName: string;
  partySize: number;
  time: string;
  status: "UPCOMING" | "CHECKED_IN" | "NOT_APPEARED";
}

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
type Weekday = (typeof WEEKDAYS)[number];

interface AvailabilitySlot {
  id: string;
  daysOfWeek: Weekday[];
  time: string; // 24h "HH:mm"
  tables: number;
  minDiners: number;
  maxDiners: number;
}

interface RestaurantTable {
  id: string;
  name: string;
  capacity: number;
}

interface DashboardData {
  reservations: Reservation[];
  schedule: AvailabilitySlot[];
  tables: RestaurantTable[];
}

const statusVariant: Record<Reservation["status"], "default" | "secondary" | "outline"> = {
  UPCOMING: "outline",
  CHECKED_IN: "default",
  NOT_APPEARED: "secondary",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// "20:00" -> "8:00pm"
function formatTimeOfDay(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")}${period}`;
}

const DAY_LABEL: Record<Weekday, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

// Collapses ["MON","TUE","WED","THU"] -> "Mon - Thu", ["SUN"] -> "Sun",
// non-contiguous selections fall back to a comma list.
function formatDays(days: Weekday[]) {
  const indices = days
    .map((d) => WEEKDAYS.indexOf(d))
    .sort((a, b) => a - b);
  const isContiguous = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
  if (isContiguous && indices.length > 1) {
    return `${DAY_LABEL[WEEKDAYS[indices[0]]]} - ${DAY_LABEL[WEEKDAYS[indices[indices.length - 1]]]}`;
  }
  return indices.map((idx) => DAY_LABEL[WEEKDAYS[idx]]).join(", ");
}

export default function DashboardPage() {
  const { data, loading, error } = useQuery<DashboardData>(DASHBOARD_QUERY, {
    variables: { restaurantId: RESTAURANT_ID },
  });
  const [checkIn] = useMutation(CHECK_IN_MUTATION, { refetchQueries: [DASHBOARD_QUERY] });
  const [markNotAppeared] = useMutation(NOT_APPEARED_MUTATION, { refetchQueries: [DASHBOARD_QUERY] });

  return (
    <main className="mx-auto max-w-4xl w-full p-8">
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-muted-foreground text-sm">Loading…</p>}
          {error && (
            <p className="text-destructive text-sm">
              Failed to load dashboard: {error.message}
            </p>
          )}
          {data && (
            <Tabs defaultValue="reservations">
              <TabsList>
                <TabsTrigger value="reservations">Reservations</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="tables">Tables</TabsTrigger>
              </TabsList>

              <TabsContent value="reservations">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Diner</TableHead>
                      <TableHead>Party</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.reservations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.dinerName}</TableCell>
                        <TableCell>{r.partySize}</TableCell>
                        <TableCell>{formatTime(r.time)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
                        </TableCell>
                        <TableCell className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={r.status !== "UPCOMING"}
                            onClick={() => checkIn({ variables: { id: r.id } })}
                          >
                            Check in
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={r.status !== "UPCOMING"}
                            onClick={() => markNotAppeared({ variables: { id: r.id } })}
                          >
                            No-show
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="schedule">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Days</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Tables</TableHead>
                      <TableHead>Diners</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.schedule.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{formatDays(s.daysOfWeek)}</TableCell>
                        <TableCell>{formatTimeOfDay(s.time)}</TableCell>
                        <TableCell>{s.tables}</TableCell>
                        <TableCell>{s.minDiners}-{s.maxDiners}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="tables">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Capacity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tables.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{t.name}</TableCell>
                        <TableCell>{t.capacity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
