"use client";

import { useCallback, useEffect, useRef } from "react";
import { CreateTripDialog } from "@/components/create-trip-dialog";
import { Fab } from "@/components/fab";
import { TripCard } from "@/components/trip-card";
import { TripToolbar } from "@/components/trip-toolbar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { pageTitle } from "@/lib/constants";
import { type HomeTab, useHomeTrips } from "@/lib/hooks/use-home-trips";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { useSwipeTab } from "@/lib/hooks/use-swipe-tab";
import { useUnsettledTripIds } from "@/lib/hooks/use-unsettled-trip-ids";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";

const HOME_TABS = ["owned", "shared"] as const satisfies readonly HomeTab[];

function SpHomeSkeleton() {
  return (
    <div className="mt-4">
      {/* Tab bar */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <Skeleton className="h-9 rounded-md" />
        <Skeleton className="h-9 rounded-md" />
      </div>
      {/* Toolbar: search + filter row */}
      <div className="mt-4 flex flex-col gap-2">
        <Skeleton className="h-10 w-full rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-md" />
          <Skeleton className="h-9 flex-1 rounded-md" />
          <Skeleton className="h-9 flex-1 rounded-md" />
        </div>
      </div>
      {/* Trip cards */}
      <div className="mt-4 grid gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border">
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SpHomePage() {
  const {
    ownedTrips,
    sharedTrips,
    isLoading,
    error,
    tab,
    setTab,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortKey,
    setSortKey,
    selectionMode,
    setSelectionMode,
    selectedIds,
    handleSelect,
    handleSelectAll,
    handleDeselectAll,
    deleting,
    duplicating,
    handleDeleteSelected,
    handleDuplicateSelected,
    createTripOpen,
    setCreateTripOpen,
    filteredTrips,
    invalidateAll,
  } = useHomeTrips();

  const unsettledTripIds = useUnsettledTripIds();
  const online = useOnlineStatus();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Swipe refs
  const tabRef = useRef<HomeTab>("owned");
  const contentRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = pageTitle("ホーム");
  }, []);

  const handleTabChange = useCallback(
    (newTab: HomeTab) => {
      if (newTab === tabRef.current) return;
      tabRef.current = newTab;
      setTab(newTab);
      setSearch("");
      setStatusFilter("all");
      setSortKey("updatedAt");
      setSelectionMode(false);
    },
    [setTab, setSearch, setStatusFilter, setSortKey, setSelectionMode],
  );

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
    // isLoading is included so the effect re-runs when data loads
    enabled: !isLoading && !error,
  });

  const adjacentTab =
    swipe.adjacent === "next"
      ? HOME_TABS[currentTabIdx + 1]
      : swipe.adjacent === "prev"
        ? HOME_TABS[currentTabIdx - 1]
        : undefined;

  // Only card content — toolbar lives outside the swipe container so that the
  // search <input> never blocks swipe initiation.
  function renderCardList(targetTab: HomeTab) {
    const isActive = targetTab === tab;
    const baseData = targetTab === "shared" ? sharedTrips : ownedTrips;
    const displayTrips = isActive ? filteredTrips : baseData;

    if (baseData.length === 0) {
      return (
        <EmptyState
          message={targetTab === "shared" ? MSG.EMPTY_TRIP_SHARED : MSG.EMPTY_TRIP}
          variant="page"
        />
      );
    }

    if (displayTrips.length === 0) {
      return <EmptyState message={MSG.EMPTY_TRIP_FILTER} variant="page" />;
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
            unsettled={unsettledTripIds.has(trip.id)}
          />
        ))}
      </div>
    );
  }

  const tabs = [
    { value: "owned", label: "自分の旅行" },
    { value: "shared", label: "共有された旅行" },
  ] as const;

  const errorFallback = error ? (
    <div className="mt-8 text-center">
      <p className="text-destructive">{MSG.TRIP_FETCH_FAILED}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={() => invalidateAll()}>
        再試行
      </Button>
    </div>
  ) : undefined;

  return (
    <>
      <LoadingBoundary
        isLoading={isLoading}
        skeleton={<SpHomeSkeleton />}
        error={error}
        errorFallback={errorFallback}
      >
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
            onSelectionModeChange={setSelectionMode}
            selectedCount={selectedIds.size}
            totalCount={filteredTrips.length}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onDeleteSelected={handleDeleteSelected}
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
          <div ref={swipeRef} className="relative touch-pan-y will-change-transform">
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
      </LoadingBoundary>
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
