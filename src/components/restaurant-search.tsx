"use client";

import { useEffect, useState } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/apollo-client";
import type { RestaurantSummary } from "@/lib/use-current-user";
import { useSelectedRestaurant } from "@/lib/use-selected-restaurant";

const SEARCH_RESTAURANTS_QUERY = gql`
  query SearchRestaurants($query: String!) {
    searchRestaurants(query: $query, limit: 10) {
      id
      title
      city
    }
  }
`;

// The backend rejects shorter queries; don't send them.
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

// Internal admins aren't mapped to restaurants, so instead of a picker they
// search by name (or type an ID). Results and access are decided server-side
// by searchRestaurants / restaurant(id).
export function RestaurantSearch({ compact = false }: { compact?: boolean }) {
  const { setRestaurantId } = useSelectedRestaurant();
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => setTerm(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [text]);

  const searchable = term.length >= MIN_QUERY_LENGTH;
  const { data, loading, error } = useQuery<{ searchRestaurants: RestaurantSummary[] }>(
    SEARCH_RESTAURANTS_QUERY,
    { variables: { query: term }, skip: !searchable }
  );
  const results = searchable ? data?.searchRestaurants ?? [] : [];

  function choose(restaurant: RestaurantSummary) {
    setRestaurantId(restaurant.id);
    setText("");
    setTerm("");
    setOpen(false);
  }

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <Input
        type="search"
        placeholder="Search restaurants…"
        aria-label="Search restaurants"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && results[0]) choose(results[0]);
        }}
        className={compact ? "h-8 w-48" : "w-full max-w-sm"}
      />
      {open && searchable && (
        <div className={`bg-popover text-popover-foreground absolute ${compact ? "right-0" : "left-0"} z-50 mt-1 w-72 rounded-md border p-1 shadow-md`}>
          {loading && !data && <p className="text-muted-foreground px-2 py-1.5 text-sm">Searching…</p>}
          {error && <p className="text-destructive px-2 py-1.5 text-sm">{getErrorMessage(error)}</p>}
          {!loading && !error && results.length === 0 && (
            <p className="text-muted-foreground px-2 py-1.5 text-sm">No restaurants match “{term}”.</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => choose(r)}
              className="hover:bg-accent focus:bg-accent flex w-full items-baseline justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none"
            >
              <span className="truncate">{r.title}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {r.city ? `${r.city} · ` : ""}#{r.id}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
