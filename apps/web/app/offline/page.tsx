"use client";

import type { TripListItem } from "@sugara/shared";
import type { PersistedClient } from "@tanstack/react-query-persist-client";
import { WifiOff } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { pageTitle } from "@/lib/constants";

export default function OfflinePage() {
  const tc = useTranslations("common");
  const [trips, setTrips] = useState<TripListItem[]>([]);

  useEffect(() => {
    document.title = pageTitle(tc("offline"));
  }, [tc]);

  useEffect(() => {
    async function loadCachedTrips() {
      try {
        const { get } = await import("idb-keyval");
        const persisted = await get<PersistedClient>("sugara-query-cache");
        if (!persisted?.clientState?.queries) return;

        const owned = persisted.clientState.queries.find(
          (q) => q.queryKey[0] === "trips" && q.queryKey[1] === "owned",
        );
        const shared = persisted.clientState.queries.find(
          (q) => q.queryKey[0] === "trips" && q.queryKey[1] === "shared",
        );

        const all = [
          ...((owned?.state?.data as TripListItem[] | undefined) ?? []),
          ...((shared?.state?.data as TripListItem[] | undefined) ?? []),
        ].sort((a, b) => ((b.updatedAt ?? "") > (a.updatedAt ?? "") ? 1 : -1));

        setTrips(all);
      } catch {
        // IndexedDB not available
      }
    }
    loadCachedTrips();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 px-4 pt-16">
      <div className="text-center">
        <WifiOff className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-medium">{tc("offline")}</p>
        <p className="mt-2 text-muted-foreground text-sm">{tc("offlineRetry")}</p>
      </div>

      {trips.length > 0 && (
        <div className="mt-4 w-full max-w-sm">
          <h2 className="mb-3 font-medium text-muted-foreground text-sm">{tc("cachedTrips")}</h2>
          <div className="flex flex-col gap-2">
            {trips.map((trip) => (
              <Link
                key={trip.id}
                href={`/trips/${trip.id}`}
                className="rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <p className="font-medium">{trip.title}</p>
                {trip.destination && (
                  <p className="text-muted-foreground text-sm">{trip.destination}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
