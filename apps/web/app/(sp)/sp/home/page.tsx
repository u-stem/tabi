"use client";

import type { TripListItem } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSwipeTab } from "@/lib/hooks/use-swipe-tab";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type HomeTab = "owned" | "shared";
const HOME_TABS = ["owned", "shared"] as const satisfies readonly HomeTab[];

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
  const tabRef = useRef<HomeTab>("owned");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");

  const [createTripOpen, setCreateTripOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Swipe refs
  const contentRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<HTMLDivElement>(null);

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

  const handleTabChange = useCallback((newTab: HomeTab) => {
    if (newTab === tabRef.current) return;
    tabRef.current = newTab;
    setTab(newTab);
    setSearch("");
    setStatusFilter("all");
    setSortKey("updatedAt");
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      const idx = HOME_TABS.indexOf(tabRef.current);
      if (idx === -1) return;
      const nextIdx = direction === "left" ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= HOME_TABS.length) return;
      handleTabChange(HOME_TABS[nextIdx]);
    },
    [handleTabChange],
  );

  const currentTabIdx = HOME_TABS.indexOf(tab);
  // enabled transitions false→true when content (and refs) become visible,
  // triggering the effect to re-run and register listeners.
  const swipe = useSwipeTab(contentRef, swipeRef, {
    onSwipeComplete: handleSwipe,
    canSwipePrev: currentTabIdx > 0,
    canSwipeNext: currentTabIdx < HOME_TABS.length - 1,
    enabled: !showSkeleton && !error,
  });

  const adjacentTab =
    swipe.adjacent === "next"
      ? HOME_TABS[currentTabIdx + 1]
      : swipe.adjacent === "prev"
        ? HOME_TABS[currentTabIdx - 1]
        : undefined;

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

  // Only card content — toolbar lives outside the swipe container so that the
  // search <input> never blocks swipe initiation.
  function renderCardList(targetTab: HomeTab) {
    const isActive = targetTab === tab;
    const baseData = targetTab === "shared" ? sharedTrips : ownedTrips;
    const displayTrips = isActive ? filteredTrips : baseData;

    if (baseData.length === 0) {
      return (
        <p className="mt-8 text-center text-muted-foreground">
          {targetTab === "shared"
            ? "共有された旅行はありません"
            : "まだ旅行がありません。旅行を作成してプランを立てましょう"}
        </p>
      );
    }

    if (displayTrips.length === 0) {
      return (
        <p className="mt-8 text-center text-muted-foreground">条件に一致する旅行がありません</p>
      );
    }

    return (
      <div className="mt-4 grid items-start gap-4">
        {displayTrips.map((trip, index) => (
          <TripCard
            key={trip.id}
            {...trip}
            hrefPrefix="/sp/trips"
            priority={isActive && index === 0}
            selectable={isActive && selectionMode}
            selected={isActive ? selectedIds.has(trip.id) : false}
            onSelect={isActive ? handleSelect : undefined}
          />
        ))}
      </div>
    );
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
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            <Skeleton className="h-9 rounded-md" />
            <Skeleton className="h-9 rounded-md" />
          </div>
          <div className="mt-4 flex flex-col gap-2">
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
              <div key={key} className="rounded-lg border bg-card shadow-sm">
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
          {/* Tab bar */}
          <div
            role="tablist"
            aria-orientation="horizontal"
            className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
          >
            {tabs.map(({ value, label }, index) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                tabIndex={tab === value ? 0 : -1}
                onClick={() => handleTabChange(value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    handleTabChange(tabs[(index + 1) % tabs.length].value);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    handleTabChange(tabs[(index - 1 + tabs.length) % tabs.length].value);
                  }
                }}
                className={cn(
                  "min-h-[36px] rounded-md px-2 py-1.5 text-sm font-medium transition-[colors,transform] active:scale-[0.97]",
                  tab === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Toolbar is outside the swipe container so the search <input> never
              blocks swipe initiation. Only card content goes inside. */}
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
              onDeleteSelected={handleDeleteSelectedTrips}
              onDuplicateSelected={handleDuplicateSelected}
              deleting={deleting}
              duplicating={duplicating}
              disabled={!online}
              hideDelete={tab === "shared"}
            />
          </div>

          {/* Swipe area - px-0.5/-mx-0.5 allows focus rings to bleed past overflow-x-hidden boundary.
              min-h-[60vh] ensures a large touch target even when the card list is empty. */}
          <div
            ref={contentRef}
            className="mt-2 min-h-[60vh] overflow-x-hidden px-0.5 -mx-0.5 touch-pan-y"
          >
            <div
              ref={swipeRef}
              className="relative touch-pan-y"
              style={{ willChange: swipe.adjacent ? "transform" : "auto" }}
            >
              {/* Current tab - pt-0.5 prevents the top of the focus ring from being clipped */}
              <div className="pt-0.5">{renderCardList(tab)}</div>

              {/* Adjacent tab (rendered only during swipe) */}
              {swipe.adjacent && adjacentTab && (
                <div
                  className="absolute top-0 left-0 w-full pt-0.5"
                  aria-hidden="true"
                  style={{
                    transform: swipe.adjacent === "next" ? "translateX(100%)" : "translateX(-100%)",
                  }}
                >
                  {renderCardList(adjacentTab)}
                </div>
              )}
            </div>
          </div>
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
