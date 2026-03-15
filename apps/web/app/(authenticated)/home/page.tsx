"use client";

import { MAX_TRIPS_PER_USER } from "@sugara/shared";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { CreateTripDialog } from "@/components/create-trip-dialog";
import { Fab } from "@/components/fab";
import type { ShortcutGroup } from "@/components/shortcut-help-dialog";
import { TripCard } from "@/components/trip-card";
import { TripToolbar } from "@/components/trip-toolbar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { pageTitle } from "@/lib/constants";
import { type HomeTab, useHomeTrips } from "@/lib/hooks/use-home-trips";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { useUnsettledTripIds } from "@/lib/hooks/use-unsettled-trip-ids";
import { isDialogOpen } from "@/lib/hotkeys";
import { MSG } from "@/lib/messages";
import { useRegisterShortcuts, useShortcutHelp } from "@/lib/shortcut-help-context";
import { cn } from "@/lib/utils";

function HomeSkeleton() {
  return (
    <div>
      {/* Tab pills */}
      <div className="mt-4 flex gap-1.5">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      {/* TripToolbar */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Skeleton className="h-8 w-full sm:w-40 sm:flex-none" />
        <Skeleton className="h-8 flex-1 sm:w-[120px] sm:flex-none" />
        <Skeleton className="h-8 flex-1 sm:w-20 sm:flex-none" />
        <Skeleton className="h-8 w-16 sm:ml-auto" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}

export default function HomePage() {
  const {
    ownedTrips,
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
    baseTrips,
    filteredTrips,
    invalidateAll,
  } = useHomeTrips();

  const unsettledTripIds = useUnsettledTripIds();
  const online = useOnlineStatus();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { open: openShortcutHelp } = useShortcutHelp();
  const homeShortcuts: ShortcutGroup[] = useMemo(
    () => [
      {
        group: "全般",
        items: [
          { key: "/", description: "検索にフォーカス" },
          { key: "n", description: "新規作成" },
        ],
      },
    ],
    [],
  );
  useRegisterShortcuts(homeShortcuts);

  useEffect(() => {
    document.title = pageTitle("ホーム");
  }, []);

  useHotkeys("?", () => openShortcutHelp(), { useKey: true, preventDefault: true });
  useHotkeys(
    "/",
    () => {
      if (!isDialogOpen()) searchInputRef.current?.focus();
    },
    { useKey: true, preventDefault: true },
  );
  useHotkeys(
    "n",
    () => {
      if (!isDialogOpen()) setCreateTripOpen(true);
    },
    { preventDefault: true },
  );

  function handleTabChange(newTab: HomeTab) {
    if (newTab === tab) return;
    setTab(newTab);
    setSearch("");
    setStatusFilter("all");
    setSortKey("updatedAt");
    setSelectionMode(false);
  }

  const newTripButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Button size="sm" disabled={!online} onClick={() => setCreateTripOpen(true)}>
            <Plus className="h-4 w-4" />
            新規作成
            <span className="hidden text-xs text-muted-foreground lg:inline">(N)</span>
          </Button>
        </span>
      </TooltipTrigger>
      {ownedTrips.length >= MAX_TRIPS_PER_USER && (
        <TooltipContent>{MSG.LIMIT_TRIPS}</TooltipContent>
      )}
    </Tooltip>
  );

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
        skeleton={<HomeSkeleton />}
        error={error}
        errorFallback={errorFallback}
      >
        <div className="mt-4 flex gap-1.5" role="tablist">
          {tabs.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => handleTabChange(value)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-[colors,transform] active:scale-[0.95]",
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
            newTripSlot={tab !== "shared" ? newTripButton : undefined}
          />
        </div>
        {baseTrips.length === 0 ? (
          <EmptyState
            message={tab === "shared" ? MSG.EMPTY_TRIP_SHARED : MSG.EMPTY_TRIP}
            variant="page"
          />
        ) : filteredTrips.length === 0 ? (
          <EmptyState message={MSG.EMPTY_TRIP_FILTER} variant="page" />
        ) : (
          <div className="mt-4 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTrips.map((trip, index) => (
              <div
                key={trip.id}
                className="animate-in fade-in duration-300"
                style={{
                  animationDelay: `${Math.min(index * 50, 300)}ms`,
                  animationFillMode: "both",
                }}
              >
                <TripCard
                  {...trip}
                  priority={index === 0}
                  selectable={selectionMode}
                  selected={selectedIds.has(trip.id)}
                  onSelect={handleSelect}
                  unsettled={unsettledTripIds.has(trip.id)}
                />
              </div>
            ))}
          </div>
        )}
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
