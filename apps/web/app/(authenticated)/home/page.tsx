"use client";

import type { TripListItem } from "@tabi/shared";
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
    api<TripListItem[]>("/api/trips")
      .then(setTrips)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/auth/login");
          return;
        }
        setError("旅行の取得に失敗しました");
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
        const fresh = await api<TripListItem[]>("/api/trips");
        setTrips(fresh);
      } catch {
        // Fallback: remove only successfully deleted trips
        const succeededIds = new Set(ids.filter((_, i) => results[i].status === "fulfilled"));
        setTrips((prev) => prev.filter((t) => !succeededIds.has(t.id)));
      }
    }

    if (failed > 0) {
      toast.error(`${failed}件の削除に失敗しました`);
    } else {
      toast.success(`${succeeded}件の旅行を削除しました`);
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
        const fresh = await api<TripListItem[]>("/api/trips");
        setTrips(fresh);
      } catch {
        // Ignore: list will be stale but not broken
      }
    }

    if (failed > 0) {
      toast.error(`${failed}件の複製に失敗しました`);
    } else {
      toast.success(`${succeeded}件の旅行を複製しました`);
    }

    setSelectedIds(new Set());
    setSelectionMode(false);
    setDuplicating(false);
  }

  return (
    <div>
      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
            <div key={key} className="rounded-lg border p-6 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="mt-8 text-destructive">{error}</p>
      ) : trips.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <p className="text-lg text-muted-foreground">まだ旅行がありません</p>
          <p className="text-sm text-muted-foreground">最初の旅行プランを作成してみましょう</p>
          {online ? (
            <Button asChild>
              <Link href="/trips/new">
                <Plus className="h-4 w-4" />
                旅行を作成
              </Link>
            </Button>
          ) : (
            <Button disabled>
              <Plus className="h-4 w-4" />
              旅行を作成
            </Button>
          )}
        </div>
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
          {filteredTrips.length === 0 ? (
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
