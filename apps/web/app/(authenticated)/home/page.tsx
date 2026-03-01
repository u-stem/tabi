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
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { pageTitle } from "@/lib/constants";
import { type HomeTab, useHomeTrips } from "@/lib/hooks/use-home-trips";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { isDialogOpen } from "@/lib/hotkeys";
import { MSG } from "@/lib/messages";
import { useRegisterShortcuts, useShortcutHelp } from "@/lib/shortcut-help-context";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const {
    ownedTrips,
    isLoading,
    showSkeleton,
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

  // Avoid flashing empty state during the 200ms skeleton delay
  if (isLoading && !showSkeleton) return <div />;

  const newTripButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Button size="sm" disabled={!online} onClick={() => setCreateTripOpen(true)}>
            <Plus className="h-4 w-4" />
            新規作成
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

  return (
    <>
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
                <TripCard
                  key={trip.id}
                  {...trip}
                  priority={index === 0}
                  selectable={selectionMode}
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
