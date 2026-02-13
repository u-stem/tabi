"use client";

import { MAX_TRIPS_PER_USER, type TripListItem } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { toast } from "sonner";
import { CreateTripDialog } from "@/components/create-trip-dialog";
import { PullToRefresh } from "@/components/pull-to-refresh";
import type { ShortcutGroup } from "@/components/shortcut-help-dialog";
import { TripCard } from "@/components/trip-card";
import type { SortKey, StatusFilter } from "@/components/trip-toolbar";
import { TripToolbar } from "@/components/trip-toolbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { useRegisterShortcuts, useShortcutHelp } from "@/lib/shortcut-help-context";
import { useDelayedLoading } from "@/lib/use-delayed-loading";

export default function HomePage() {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();

  const {
    data: trips = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.trips.owned(),
    queryFn: () => api<TripListItem[]>("/api/trips?scope=owned"),
  });
  useAuthRedirect(error);

  useEffect(() => {
    document.title = "ホーム - sugara";
  }, []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");

  const [createOpen, setCreateOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { open: openShortcutHelp } = useShortcutHelp();
  const homeShortcuts: ShortcutGroup[] = useMemo(
    () => [
      {
        group: "全般",
        items: [
          { key: "/", description: "検索にフォーカス" },
          { key: "n", description: "新規旅行を作成" },
        ],
      },
    ],
    [],
  );
  useRegisterShortcuts(homeShortcuts);
  const showSkeleton = useDelayedLoading(isLoading);

  useHotkeys("?", () => openShortcutHelp(), { useKey: true, preventDefault: true });
  useHotkeys("/", () => searchInputRef.current?.focus(), { useKey: true, preventDefault: true });
  useHotkeys("n", () => setCreateOpen(true), { preventDefault: true });

  const invalidateTrips = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.owned() });

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

  async function handleDeleteSingle(id: string) {
    try {
      await api(`/api/trips/${id}`, { method: "DELETE" });
      toast.success(MSG.TRIP_BULK_DELETED(1));
      await invalidateTrips();
    } catch {
      toast.error(MSG.TRIP_BULK_DELETE_FAILED(1));
    }
  }

  async function handleDuplicateSingle(id: string) {
    try {
      await api(`/api/trips/${id}/duplicate`, { method: "POST" });
      toast.success(MSG.TRIP_BULK_DUPLICATED(1));
      await invalidateTrips();
    } catch {
      toast.error(MSG.TRIP_BULK_DUPLICATE_FAILED(1));
    }
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
      await invalidateTrips();
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
      await invalidateTrips();
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

  // Avoid flashing empty state during the 200ms skeleton delay
  if (isLoading && !showSkeleton) return <div />;

  return (
    <PullToRefresh onRefresh={invalidateTrips} enabled={!isLoading}>
      {showSkeleton ? (
        <>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Skeleton className="h-8 w-full sm:w-40" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-[120px]" />
              <Skeleton className="h-8 w-[100px]" />
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
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
        <div className="mt-8 text-center">
          <p className="text-destructive">{MSG.TRIP_FETCH_FAILED}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => invalidateTrips()}>
            再試行
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <TripToolbar
              searchInputRef={searchInputRef}
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        size="sm"
                        // trips is fetched with scope=owned, so length matches owned count
                        disabled={!online || trips.length >= MAX_TRIPS_PER_USER}
                        onClick={() => setCreateOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                        新規作成
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {trips.length >= MAX_TRIPS_PER_USER && (
                    <TooltipContent>{MSG.LIMIT_TRIPS}</TooltipContent>
                  )}
                </Tooltip>
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
                  onDuplicate={handleDuplicateSingle}
                  onDelete={handleDeleteSingle}
                />
              ))}
            </div>
          )}
        </>
      )}
      <CreateTripDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidateTrips}
      />
    </PullToRefresh>
  );
}
