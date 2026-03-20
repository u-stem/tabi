"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import { CreateTripDialog } from "@/components/create-trip-dialog";
import { Fab } from "@/components/fab";
import { SpSwipeTabs, type SwipeTab } from "@/components/sp-swipe-tabs";
import { TripCard } from "@/components/trip-card";
import { TripToolbar } from "@/components/trip-toolbar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { pageTitle } from "@/lib/constants";
import { type HomeTab, useHomeTrips } from "@/lib/hooks/use-home-trips";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { useUnsettledTripIds } from "@/lib/hooks/use-unsettled-trip-ids";

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
  const tm = useTranslations("messages");
  const tt = useTranslations("trip");
  const tc = useTranslations("common");
  const tpt = useTranslations("pageTitle");

  const HOME_TABS: SwipeTab<HomeTab>[] = [
    { id: "owned", label: tt("ownedTrips") },
    { id: "shared", label: tt("sharedTrips") },
  ];

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

  useEffect(() => {
    document.title = pageTitle(tpt("home"));
  }, [tpt]);

  const handleTabChange = useCallback(
    (newTab: HomeTab) => {
      if (newTab === tab) return;
      setTab(newTab);
      setSearch("");
      setStatusFilter("all");
      setSortKey("updatedAt");
      setSelectionMode(false);
    },
    [tab, setTab, setSearch, setStatusFilter, setSortKey, setSelectionMode],
  );

  const renderContent = useCallback(
    (targetTab: HomeTab) => {
      const isActive = targetTab === tab;
      const baseData = targetTab === "shared" ? sharedTrips : ownedTrips;
      const displayTrips = isActive ? filteredTrips : baseData;

      if (baseData.length === 0) {
        return (
          <EmptyState
            message={targetTab === "shared" ? tm("emptyTripShared") : tm("emptyTrip")}
            variant="page"
          />
        );
      }

      if (displayTrips.length === 0) {
        return <EmptyState message={tm("emptyTripFilter")} variant="page" />;
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
    },
    [
      tab,
      sharedTrips,
      ownedTrips,
      filteredTrips,
      selectionMode,
      selectedIds,
      handleSelect,
      unsettledTripIds,
    ],
  );

  const errorFallback = error ? (
    <div className="mt-8 text-center">
      <p className="text-destructive">{tm("tripFetchFailed")}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={() => invalidateAll()}>
        {tc("retry")}
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
        <SpSwipeTabs<HomeTab>
          tabs={HOME_TABS}
          activeTab={tab}
          onTabChange={handleTabChange}
          renderContent={renderContent}
          swipeEnabled={!isLoading && !error}
          className="mt-4"
        >
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
        </SpSwipeTabs>
      </LoadingBoundary>
      <CreateTripDialog
        open={createTripOpen}
        onOpenChange={setCreateTripOpen}
        onCreated={invalidateAll}
      />
      <Fab
        onClick={() => setCreateTripOpen(true)}
        label={tt("createTrip")}
        hidden={!online || tab === "shared"}
      />
    </>
  );
}
