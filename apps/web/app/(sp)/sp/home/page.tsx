"use client";

import type { TripListItem } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CreateTripDialog } from "@/components/create-trip-dialog";
import { Fab } from "@/components/fab";
import { TripCard } from "@/components/trip-card";
import type { SortKey, StatusFilter } from "@/components/trip-toolbar";
import { TripToolbar } from "@/components/trip-toolbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { pageTitle } from "@/lib/constants";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type HomeTab = "owned" | "shared";

export default function SpHomePage() {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const {
    data: ownedTrips = [],
    isLoading: ownedLoading,
    error: ownedError,
  } = useQuery({
    queryKey: queryKeys.trips.owned(),
    queryFn: () => api<TripListItem[]>("/api/trips?scope=owned"),
  });
  useAuthRedirect(ownedError);

  const {
    data: sharedTrips = [],
    isLoading: sharedLoading,
    error: sharedError,
  } = useQuery({
    queryKey: queryKeys.trips.shared(),
    queryFn: () => api<TripListItem[]>("/api/trips?scope=shared"),
  });
  useAuthRedirect(sharedError);

  const isLoading = ownedLoading || sharedLoading;
  const error = ownedError || sharedError;

  useEffect(() => {
    document.title = pageTitle("ホーム");
  }, []);

  const [tab, setTab] = useState<HomeTab>("owned");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");

  const [createTripOpen, setCreateTripOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showSkeleton = useDelayedLoading(isLoading);

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.owned() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.shared() }),
    ]);
  };

  const baseTrips = useMemo(
    () => (tab === "shared" ? sharedTrips : ownedTrips),
    [tab, ownedTrips, sharedTrips],
  );

  const filteredTrips = useMemo(() => {
    let result = baseTrips;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) || (t.destination?.toLowerCase().includes(q) ?? false),
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (sortKey === "startDate") {
      result = [...result].sort((a, b) => {
        const aDate = a.startDate ?? "";
        const bDate = b.startDate ?? "";
        return aDate < bDate ? 1 : aDate > bDate ? -1 : 0;
      });
    }

    return result;
  }, [baseTrips, search, statusFilter, sortKey]);

  function handleTabChange(newTab: HomeTab) {
    if (newTab === tab) return;
    setTab(newTab);
    setSearch("");
    setStatusFilter("all");
    setSortKey("updatedAt");
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

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

  async function handleDeleteSelectedTrips() {
    const ids = [...selectedIds];
    const count = ids.length;
    const idSet = new Set(ids);

    const cacheKey = queryKeys.trips.owned();
    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripListItem[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.filter((t) => !idSet.has(t.id)),
      );
    }
    setSelectedIds(new Set());
    setSelectionMode(false);

    setDeleting(true);
    const results = await Promise.allSettled(
      ids.map((id) => api(`/api/trips/${id}`, { method: "DELETE" })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed > 0) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.TRIP_BULK_DELETE_FAILED(failed));
    } else {
      toast.success(MSG.TRIP_BULK_DELETED(count));
    }
    await invalidateAll();
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
      await invalidateAll();
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

  const tabs = [
    { value: "owned", label: "自分の旅行" },
    { value: "shared", label: "共有された旅行" },
  ] as const;

  return (
    <>
      {showSkeleton ? (
        <>
          <div className="mt-4 flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-[120px]" />
              <Skeleton className="h-8 w-[100px]" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
          <div className="mt-4 grid gap-4">
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
          <Button variant="outline" size="sm" className="mt-4" onClick={() => invalidateAll()}>
            再試行
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-1.5">
            {tabs.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleTabChange(value)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-[colors,transform] active:scale-[0.95]",
                  tab === value
                    ? "bg-muted text-foreground"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

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
              onSelectionModeChange={tab !== "shared" ? handleSelectionModeChange : undefined}
              selectedCount={selectedIds.size}
              totalCount={filteredTrips.length}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onDeleteSelected={handleDeleteSelectedTrips}
              onDuplicateSelected={handleDuplicateSelected}
              deleting={deleting}
              duplicating={duplicating}
              disabled={!online}
            />
          </div>
          {baseTrips.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground">
              {tab === "shared"
                ? "共有された旅行はありません"
                : "まだ旅行がありません。旅行を作成してプランを立てましょう"}
            </p>
          ) : filteredTrips.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground">条件に一致する旅行がありません</p>
          ) : (
            <div className="mt-4 grid items-start gap-4">
              {filteredTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  {...trip}
                  hrefPrefix="/sp/trips"
                  selectable={selectionMode && tab === "owned"}
                  selected={selectedIds.has(trip.id)}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </>
      )}
      <CreateTripDialog
        open={createTripOpen}
        onOpenChange={setCreateTripOpen}
        onCreated={invalidateAll}
      />
      <Fab
        onClick={() => setCreateTripOpen(true)}
        label="旅行を新規作成"
        hidden={!online || tab === "shared"}
      />
    </>
  );
}
