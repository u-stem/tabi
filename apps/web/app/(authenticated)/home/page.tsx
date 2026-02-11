"use client";

import type { TripListItem } from "@sugara/shared";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { toast } from "sonner";
import { TripCard } from "@/components/trip-card";
import type { SortKey, StatusFilter } from "@/components/trip-toolbar";
import { TripToolbar } from "@/components/trip-toolbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { MSG } from "@/lib/messages";

export default function HomePage() {
  const router = useRouter();
  const online = useOnlineStatus();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    api<TripListItem[]>("/api/trips?scope=owned")
      .then((data) => {
        setTrips(data);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/auth/login");
          return;
        }
        setError(MSG.TRIP_FETCH_FAILED);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const filteredTrips = useMemo(() => {
    let result = trips;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q) || t.destination.toLowerCase().includes(q),
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (sortKey === "startDate") {
      result = [...result].sort((a, b) =>
        a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0,
      );
    }
    // "updatedAt" preserves API order (already sorted by updatedAt desc)

    return result;
  }, [trips, search, statusFilter, sortKey]);

  // Prune selectedIds to only include visible trips when filters change
  useEffect(() => {
    if (!selectionMode) return;
    const visibleIds = new Set(filteredTrips.map((t) => t.id));
    setSelectedIds((prev) => {
      const pruned = new Set([...prev].filter((id) => visibleIds.has(id)));
      if (pruned.size === prev.size) return prev;
      return pruned;
    });
  }, [filteredTrips, selectionMode]);

  function handleSelectionModeChange(mode: boolean) {
    setSelectionMode(mode);
    if (!mode) {
      setSelectedIds(new Set());
    }
  }

  function handleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedIds(new Set(filteredTrips.map((t) => t.id)));
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  async function handleDeleteSelected() {
    const ids = [...selectedIds];
    setDeleting(true);

    const results = await Promise.allSettled(
      ids.map((id) => api(`/api/trips/${id}`, { method: "DELETE" })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.filter((r) => r.status === "fulfilled").length;

    if (succeeded > 0) {
      try {
        const fresh = await api<TripListItem[]>("/api/trips?scope=owned");
        setTrips(fresh);
      } catch {
        // Fallback: remove only successfully deleted trips
        const succeededIds = new Set(ids.filter((_, i) => results[i].status === "fulfilled"));
        setTrips((prev) => prev.filter((t) => !succeededIds.has(t.id)));
      }
    }

    if (failed > 0) {
      toast.error(MSG.TRIP_BULK_DELETE_FAILED(failed));
    } else {
      toast.success(MSG.TRIP_BULK_DELETED(succeeded));
    }

    setSelectedIds(new Set());
    setSelectionMode(false);
    setDeleting(false);
  }

  async function handleDuplicateSelected() {
    const ids = [...selectedIds];
    setDuplicating(true);

    const results = await Promise.allSettled(
      ids.map((id) => api(`/api/trips/${id}/duplicate`, { method: "POST" })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.filter((r) => r.status === "fulfilled").length;

    if (succeeded > 0) {
      try {
        const fresh = await api<TripListItem[]>("/api/trips?scope=owned");
        setTrips(fresh);
      } catch {
        // Ignore: list will be stale but not broken
      }
    }

    if (failed > 0) {
      toast.error(MSG.TRIP_BULK_DUPLICATE_FAILED(failed));
    } else {
      toast.success(MSG.TRIP_BULK_DUPLICATED(succeeded));
    }

    setSelectedIds(new Set());
    setSelectionMode(false);
    setDuplicating(false);
  }

  return (
    <div>
      {loading ? (
        <>
          <div className="mt-4 flex items-center gap-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-[120px]" />
            <Skeleton className="h-8 w-[100px]" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
              <div key={key} className="rounded-xl border bg-card shadow">
                <div className="flex flex-col space-y-1.5 p-6">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="p-6 pt-0">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-1 h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : error ? (
        <p className="mt-8 text-destructive">{error}</p>
      ) : (
        <>
          <div className="mt-4">
            <TripToolbar
              search={search}
              onSearchChange={setSearch}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sortKey={sortKey}
              onSortKeyChange={setSortKey}
              selectionMode={selectionMode}
              onSelectionModeChange={handleSelectionModeChange}
              selectedCount={selectedIds.size}
              totalCount={filteredTrips.length}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onDeleteSelected={handleDeleteSelected}
              onDuplicateSelected={handleDuplicateSelected}
              deleting={deleting}
              duplicating={duplicating}
              disabled={!online}
              newTripSlot={
                online ? (
                  <Button asChild size="sm">
                    <Link href="/trips/new">
                      <Plus className="h-4 w-4" />
                      新規作成
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" disabled>
                    <Plus className="h-4 w-4" />
                    新規作成
                  </Button>
                )
              }
            />
          </div>
          {trips.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground">
              まだ旅行がありません。新規作成から旅行プランを作成してみましょう
            </p>
          ) : filteredTrips.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground">条件に一致する旅行がありません</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  {...trip}
                  selectable={selectionMode}
                  selected={selectedIds.has(trip.id)}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
