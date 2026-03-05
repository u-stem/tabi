"use client";

import { DndContext } from "@dnd-kit/core";
import type { BookmarkListResponse, PollDetailResponse, TripResponse } from "@sugara/shared";
import {
  canEdit as canEditRole,
  isOwner as isOwnerRole,
  MAX_SCHEDULES_PER_TRIP,
} from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { APIProvider } from "@vis.gl/react-google-maps";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { ActivityLog } from "@/components/activity-log";
import { BookmarkListPickerDialog } from "@/components/bookmark-list-picker-dialog";
import { BookmarkPanel } from "@/components/bookmark-panel";
import { CandidatePanel } from "@/components/candidate-panel";
import { DayTimeline } from "@/components/day-timeline";
import { ExpensePanel } from "@/components/expense-panel";
import { Fab } from "@/components/fab";
import {
  getMobileTabIds,
  getMobileTabPanelId,
  getMobileTabTriggerId,
  type MobileContentTab,
  MobileContentTabs,
} from "@/components/mobile-content-tabs";
import { SouvenirPanel } from "@/components/souvenir-panel";

const EditTripDialog = dynamic(() =>
  import("@/components/edit-trip-dialog").then((mod) => mod.EditTripDialog),
);

// Reuse trip page sub-components from the desktop page's _components
import { DayMemoEditor } from "@/app/(authenticated)/trips/[id]/_components/day-memo-editor";
import { DayTabs } from "@/app/(authenticated)/trips/[id]/_components/day-tabs";
import { MapPanel } from "@/app/(authenticated)/trips/[id]/_components/map-panel";
import { PatternTabs } from "@/app/(authenticated)/trips/[id]/_components/pattern-tabs";
import { PollTab } from "@/app/(authenticated)/trips/[id]/_components/poll-tab";
import {
  AddPatternDialog,
  BatchDeleteDialog,
  DeletePatternDialog,
  OverwritePatternDialog,
  RenamePatternDialog,
} from "@/app/(authenticated)/trips/[id]/_components/trip-dialogs";
import { TripHeader } from "@/app/(authenticated)/trips/[id]/_components/trip-header";
import { DayWeatherEditor } from "@/components/day-weather-editor";
import { useSpScrollContainer } from "@/components/sp-scroll-container";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { getCrossDayEntries } from "@/lib/cross-day";
import { isGuestUser } from "@/lib/guest";
import { SelectionProvider } from "@/lib/hooks/selection-context";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useAutoStatusTransition } from "@/lib/hooks/use-auto-status-transition";
import { useCurrentTime } from "@/lib/hooks/use-current-time";
import { useDayMemo } from "@/lib/hooks/use-day-memo";
import { useDayWeather } from "@/lib/hooks/use-day-weather";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { usePatternOperations } from "@/lib/hooks/use-pattern-operations";
import { useScheduleSelection } from "@/lib/hooks/use-schedule-selection";
import { useSwipeTab } from "@/lib/hooks/use-swipe-tab";
import { useTripDragAndDrop } from "@/lib/hooks/use-trip-drag-and-drop";
import { useTripSync } from "@/lib/hooks/use-trip-sync";
import { MSG } from "@/lib/messages";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

export default function SpTripDetailPage() {
  const params = useParams();
  const tripId = typeof params.id === "string" ? params.id : null;
  const online = useOnlineStatus();
  const now = useCurrentTime();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const spScrollRef = useSpScrollContainer();

  const {
    data: trip = null,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.trips.detail(tripId ?? ""),
    queryFn: () => api<TripResponse>(`/api/trips/${tripId}`),
    enabled: tripId !== null,
  });
  useAuthRedirect(queryError);
  const pollId = trip?.poll?.id;
  const { isLoading: isPollLoading, data: pollData } = useQuery({
    queryKey: queryKeys.polls.detail(pollId ?? ""),
    queryFn: () => api<PollDetailResponse>(`/api/polls/${pollId}`),
    enabled: !!pollId,
  });
  // Prefetch bookmark lists
  useQuery({
    queryKey: queryKeys.bookmarks.lists(),
    queryFn: () => api<BookmarkListResponse[]>("/api/bookmark-lists"),
    ...QUERY_CONFIG.stable,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [addScheduleOpen, setAddScheduleOpen] = useState(false);
  const [addCandidateOpen, setAddCandidateOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [addSouvenirOpen, setAddSouvenirOpen] = useState(false);
  const [addPollOptionOpen, setAddPollOptionOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedPattern, setSelectedPattern] = useState<Record<string, number>>({});
  const [mobileTab, setMobileTab] = useState<MobileContentTab>("schedule");
  const mobileTabRef = useRef<MobileContentTab>("schedule");
  const scrollPositions = useRef<Record<string, number>>({});
  const mobileContentRef = useRef<HTMLDivElement>(null);
  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const tapTransitionRef = useRef(false);
  const [saveToBookmarkIds, setSaveToBookmarkIds] = useState<string[]>([]);
  const [bookmarkPickerOpen, setBookmarkPickerOpen] = useState(false);

  const currentDay = trip?.days[selectedDay] ?? null;
  const currentPatternIndex = currentDay ? (selectedPattern[currentDay.id] ?? 0) : 0;
  const currentPattern = currentDay?.patterns[currentPatternIndex] ?? null;

  const invalidateTrip = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId ?? "") });
    if (pollId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.polls.detail(pollId) });
    }
  }, [queryClient, tripId, pollId]);

  const syncUser = useMemo(
    () =>
      session?.user
        ? { id: session.user.id, name: session.user.name, image: session.user.image }
        : null,
    [session?.user?.id, session?.user?.name, session?.user?.image],
  );
  const { presence, isConnected, updatePresence, broadcastChange } = useTripSync(
    tripId ?? "",
    syncUser,
    invalidateTrip,
  );

  const onMutate = useCallback(async () => {
    await invalidateTrip();
    broadcastChange();
    await queryClient.invalidateQueries({ queryKey: queryKeys.trips.activityLogs(tripId ?? "") });
  }, [invalidateTrip, broadcastChange, queryClient, tripId]);

  const handleSaveToBookmark = useCallback((scheduleIds: string[]) => {
    setSaveToBookmarkIds(scheduleIds);
    setBookmarkPickerOpen(true);
  }, []);

  const handleBookmarkListSelected = useCallback(
    async (listId: string) => {
      try {
        await api(`/api/bookmark-lists/${listId}/bookmarks/from-schedules`, {
          method: "POST",
          body: JSON.stringify({ tripId, scheduleIds: saveToBookmarkIds }),
        });
        toast.success(MSG.SCHEDULE_SAVED_TO_BOOKMARKS(saveToBookmarkIds.length));
        queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all });
      } catch (err) {
        toast.error(getApiErrorMessage(err, MSG.SCHEDULE_SAVE_TO_BOOKMARKS_FAILED));
      }
    },
    [tripId, saveToBookmarkIds, queryClient],
  );

  // Restore scroll position synchronously before paint to avoid a one-frame flicker
  // where the new tab content is momentarily shown at the previous tab's scroll position.
  // On SP, the actual scroll container is SpScrollContainer (outer), not mobileContentRef.
  useLayoutEffect(() => {
    const scrollEl = spScrollRef?.current ?? mobileContentRef.current;
    scrollEl?.scrollTo(0, scrollPositions.current[mobileTab] ?? 0);
  }, [mobileTab]);

  const handleMobileTabChange = useCallback(
    (tab: MobileContentTab, source?: "tap") => {
      const scrollEl = spScrollRef?.current ?? mobileContentRef.current;
      if (scrollEl) {
        scrollPositions.current[mobileTabRef.current] = scrollEl.scrollTop;
      }
      tapTransitionRef.current = source === "tap";
      mobileTabRef.current = tab;
      setMobileTab(tab);
    },
    [spScrollRef],
  );

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      const tabIds = getMobileTabIds();
      const idx = tabIds.indexOf(mobileTabRef.current);
      if (idx === -1) return;
      const next = direction === "left" ? idx + 1 : idx - 1;
      if (next < 0 || next >= tabIds.length) return;
      handleMobileTabChange(tabIds[next]);
    },
    [handleMobileTabChange],
  );

  const tabIds = useMemo(() => getMobileTabIds(), []);
  const currentTabIdx = tabIds.indexOf(mobileTab);
  const canSwipeMobileTabs = currentTabIdx !== -1;
  const swipe = useSwipeTab(mobileContentRef, swipeContainerRef, {
    onSwipeComplete: handleSwipe,
    // !isLoading ensures refs are populated before listeners are registered.
    // Without this, enabled can flip true while skeleton is still mounted (refs null),
    // and then stays true when content renders — so the effect never re-runs.
    enabled: !isLoading && !!trip && canSwipeMobileTabs,
    canSwipePrev: canSwipeMobileTabs && currentTabIdx > 0,
    canSwipeNext: canSwipeMobileTabs && currentTabIdx < tabIds.length - 1,
  });

  useEffect(() => {
    if (trip) {
      document.title = pageTitle(trip.title);
    }
  }, [trip?.title]);

  const otherPresence = useMemo(
    () => (session?.user ? presence.filter((u) => u.userId !== session.user.id) : presence),
    [presence, session?.user],
  );

  useEffect(() => {
    if (currentDay) {
      updatePresence(currentDay.id, currentPattern?.id ?? null);
    } else if (selectedDay === -1) {
      updatePresence("poll", null);
    }
  }, [currentDay?.id, currentPattern?.id, selectedDay, updatePresence]);

  useAutoStatusTransition({ trip, tripId: tripId ?? "", now, onMutate });

  // Show poll tab by default for scheduling trips
  useEffect(() => {
    if (trip?.status === "scheduling" && trip.poll) {
      setSelectedDay(-1);
    }
  }, [trip?.status, trip?.poll?.id]);

  const dndSchedules = useMemo(() => currentPattern?.schedules ?? [], [currentPattern?.schedules]);
  const dndCandidates = useMemo(() => trip?.candidates ?? [], [trip?.candidates]);
  const dndCrossDayEntries = useMemo(
    () => (currentDay && trip ? getCrossDayEntries(trip.days, currentDay.dayNumber) : undefined),
    [currentDay?.dayNumber, trip?.days],
  );

  const allSchedules = useMemo(
    () =>
      trip?.days.flatMap((day, dayIndex) =>
        day.patterns.flatMap((p) => p.schedules.map((s) => ({ ...s, dayIndex }))),
      ) ?? [],
    [trip?.days],
  );

  const dnd = useTripDragAndDrop({
    tripId: tripId ?? "",
    currentDayId: currentDay?.id ?? null,
    currentPatternId: currentPattern?.id ?? null,
    schedules: dndSchedules,
    candidates: dndCandidates,
    crossDayEntries: dndCrossDayEntries,
    onDone: onMutate,
  });

  const patternOps = usePatternOperations({
    tripId: tripId ?? "",
    currentDayId: currentDay?.id ?? null,
    onDone: onMutate,
    onPatternDeleted: (dayId) => setSelectedPattern((prev) => ({ ...prev, [dayId]: 0 })),
  });

  const memo = useDayMemo({
    tripId: tripId ?? "",
    currentDayId: currentDay?.id ?? null,
    onDone: onMutate,
  });

  const weather = useDayWeather({
    tripId: tripId ?? "",
    currentDayId: currentDay?.id ?? null,
    onDone: onMutate,
  });

  const timelineScheduleIds = useMemo(
    () => new Set(currentPattern?.schedules.map((s) => s.id) ?? []),
    [currentPattern?.schedules],
  );

  const candidateIds = useMemo(
    () => new Set(dnd.localCandidates.map((c) => c.id)),
    [dnd.localCandidates],
  );

  const selection = useScheduleSelection({
    tripId: tripId ?? "",
    currentDayId: currentDay?.id ?? null,
    currentPatternId: currentPattern?.id ?? null,
    timelineScheduleIds,
    candidateIds,
    onDone: onMutate,
  });

  useEffect(() => {
    selection.exit();
  }, [selectedDay, mobileTab]);

  // Prevent outer SpScrollContainer from scrolling during swipe.
  // useLayoutEffect (not useEffect) so the overflow restore happens before
  // paint — otherwise a second paint with changed overflow causes a visible
  // position shift on the tab bar (the candidate count number "floats").
  const isActivelySwiping = swipe.adjacent !== null || swipe.isAnimating;
  useLayoutEffect(() => {
    const el = spScrollRef?.current;
    if (!el || !isActivelySwiping) return;
    el.style.overflow = "hidden";
    return () => {
      el.style.overflow = "";
    };
  }, [isActivelySwiping, spScrollRef]);

  // Routing guarantees params.id is always a string, but guard defensively
  if (!tripId) return null;

  const canEdit = trip ? canEditRole(trip.role) : false;
  const isGuest = isGuestUser(session);
  const scheduleLimitReached = trip ? trip.scheduleCount >= MAX_SCHEDULES_PER_TRIP : false;
  const scheduleLimitMessage = MSG.LIMIT_SCHEDULES;
  const selectionValue = { ...selection, canEnter: canEdit && online };

  const adjacentTabId = swipe.adjacent
    ? (tabIds[currentTabIdx + (swipe.adjacent === "next" ? 1 : -1)] ?? null)
    : null;

  function renderTabContent(tabId: MobileContentTab) {
    if (!trip) return null;
    switch (tabId) {
      case "schedule":
        return (
          <div className="flex min-w-0 flex-col rounded-lg border bg-card">
            <DayTabs
              days={trip.days}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              otherPresence={otherPresence}
              hasPoll={!!trip.poll}
            />
            {selectedDay === -1 && trip.poll ? (
              <div>
                <PollTab
                  pollId={trip.poll.id}
                  isOwner={isOwnerRole(trip.role)}
                  canEdit={canEdit}
                  onMutate={onMutate}
                  onConfirmed={() => setSelectedDay(0)}
                  addOptionOpen={addPollOptionOpen}
                  onAddOptionOpenChange={setAddPollOptionOpen}
                />
              </div>
            ) : currentDay && currentPattern ? (
              <div id={`mobile-day-panel-${currentDay.id}`} role="tabpanel" className="p-4">
                <DayWeatherEditor
                  weatherHook={weather}
                  currentDayId={currentDay.id}
                  currentWeatherType={currentDay.weatherType}
                  currentWeatherTypeSecondary={currentDay.weatherTypeSecondary}
                  currentTempHigh={currentDay.tempHigh}
                  currentTempLow={currentDay.tempLow}
                  canEdit={canEdit}
                  online={online}
                  variant="drawer"
                />
                <DayMemoEditor
                  memo={memo}
                  currentDayId={currentDay.id}
                  currentDayMemo={currentDay.memo}
                  canEdit={canEdit}
                  online={online}
                />
                <DayTimeline
                  key={currentPattern.id}
                  tripId={tripId ?? ""}
                  dayId={currentDay.id}
                  patternId={currentPattern.id}
                  date={currentDay.date}
                  schedules={dnd.localSchedules}
                  onRefresh={onMutate}
                  disabled={!online || !canEdit}
                  addScheduleOpen={addScheduleOpen}
                  onAddScheduleOpenChange={setAddScheduleOpen}
                  maxEndDayOffset={Math.max(1, trip.days.length - 1 - selectedDay)}
                  totalDays={trip.days.length}
                  crossDayEntries={getCrossDayEntries(trip.days, currentDay.dayNumber)}
                  overScheduleId={dnd.activeDragItem ? dnd.overScheduleId : null}
                  scheduleLimitReached={scheduleLimitReached}
                  scheduleLimitMessage={scheduleLimitMessage}
                  onSaveToBookmark={canEdit && online ? handleSaveToBookmark : undefined}
                  onReorderSchedule={dnd.reorderSchedule}
                  mapsEnabled={trip.mapsEnabled}
                  headerContent={
                    <PatternTabs
                      patterns={currentDay.patterns}
                      currentDayId={currentDay.id}
                      currentPatternIndex={currentPatternIndex}
                      canEdit={canEdit}
                      online={online}
                      patternOps={patternOps}
                      onSelectPattern={(dayId, index) =>
                        setSelectedPattern((prev) => ({ ...prev, [dayId]: index }))
                      }
                    />
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-lg font-medium">{MSG.SCHEDULING_STATUS_TITLE}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {MSG.SCHEDULING_STATUS_DESCRIPTION}
                </p>
              </div>
            )}
          </div>
        );
      case "candidates":
        return currentDay && currentPattern ? (
          <div className="rounded-lg border bg-card p-4">
            <CandidatePanel
              tripId={tripId ?? ""}
              candidates={dnd.localCandidates}
              currentDayId={currentDay.id}
              currentPatternId={currentPattern.id}
              onRefresh={onMutate}
              disabled={!online || !canEdit}
              draggable={false}
              addDialogOpen={addCandidateOpen}
              onAddDialogOpenChange={setAddCandidateOpen}
              scheduleLimitReached={scheduleLimitReached}
              scheduleLimitMessage={scheduleLimitMessage}
              maxEndDayOffset={Math.max(0, trip.days.length - 1)}
              onSaveToBookmark={canEdit && online ? handleSaveToBookmark : undefined}
              onReorderCandidate={dnd.reorderCandidate}
              days={trip.days}
            />
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {trip.days.length > 0
              ? "日タブを選択すると候補を追加できます"
              : "日程が確定すると候補を追加できます"}
          </p>
        );
      case "expenses":
        return trip.days.length > 0 ? (
          <div className="rounded-lg border bg-card p-4">
            <ExpensePanel
              tripId={tripId ?? ""}
              canEdit={canEdit}
              addOpen={addExpenseOpen}
              onAddOpenChange={setAddExpenseOpen}
            />
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            日程が確定すると費用を記録できます
          </p>
        );
      case "bookmarks":
        return trip.days.length > 0 ? (
          <div className="rounded-lg border bg-card p-4">
            <BookmarkPanel
              tripId={tripId ?? ""}
              disabled={!online || !canEdit}
              onCandidateAdded={onMutate}
            />
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            日程が確定するとブックマークを利用できます
          </p>
        );
      case "souvenirs":
        return trip.days.length > 0 ? (
          <div className="rounded-lg border bg-card p-4">
            <SouvenirPanel
              tripId={tripId ?? ""}
              addOpen={addSouvenirOpen}
              onAddOpenChange={setAddSouvenirOpen}
            />
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            日程が確定するとお土産リストを利用できます
          </p>
        );
      case "activity":
        return <ActivityLog tripId={tripId ?? ""} />;
      case "map":
        return (
          <div className="h-[calc(100svh-14rem)]">
            <MapPanel
              tripId={tripId ?? ""}
              currentDaySchedules={currentPattern?.schedules ?? []}
              allSchedules={allSchedules}
              online={online}
            />
          </div>
        );
    }
  }

  const skeleton = (
    <div className="mt-4">
      <div className="flex h-11 items-center gap-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="ml-auto h-8 w-8 rounded-md" />
      </div>
      <div className="my-2 grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 rounded-md" />
        ))}
      </div>
      <div className="rounded-lg border bg-card">
        <div className="flex gap-1.5 px-3 pt-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[44px] w-14 rounded-full" />
          ))}
        </div>
        <div className="p-4">
          <Skeleton className="mb-3 h-9 w-full rounded-md" />
          <Skeleton className="mb-3 h-9 w-full rounded-md" />
          <div className="mb-2 flex items-center gap-1.5">
            <Skeleton className="h-8 flex-1 rounded-full" />
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          </div>
          <div className="mb-2 flex items-center gap-1.5">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 py-1.5">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <Skeleton className="h-20 flex-1 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <LoadingBoundary isLoading={isLoading || (!!pollId && isPollLoading)} skeleton={skeleton}>
      {queryError || !trip ? (
        <p className="text-destructive">{MSG.TRIP_FETCH_FAILED}</p>
      ) : (
        <MapsProvider enabled={trip.mapsEnabled}>
          <SelectionProvider value={selectionValue}>
            <div className="mt-4">
              <TripHeader
                trip={trip}
                tripId={tripId}
                otherPresence={otherPresence}
                isConnected={isConnected}
                online={online}
                canEdit={canEdit}
                onMutate={onMutate}
                onEditOpen={() => setEditOpen(true)}
                onOpenBookmarks={
                  isGuest
                    ? undefined
                    : () => {
                        handleMobileTabChange("bookmarks", "tap");
                      }
                }
                onOpenActivity={() => {
                  handleMobileTabChange("activity", "tap");
                }}
                onOpenMap={trip.mapsEnabled ? () => handleMobileTabChange("map", "tap") : undefined}
              />
              <EditTripDialog
                tripId={tripId}
                title={trip.title}
                destination={trip.destination}
                startDate={trip.startDate}
                endDate={trip.endDate}
                coverImageUrl={trip.coverImageUrl}
                coverImagePosition={trip.coverImagePosition}
                open={editOpen}
                onOpenChange={setEditOpen}
                onUpdate={onMutate}
              />
              <DndContext
                sensors={dnd.sensors}
                collisionDetection={dnd.collisionDetection}
                onDragStart={dnd.handleDragStart}
                onDragOver={dnd.handleDragOver}
                onDragEnd={dnd.handleDragEnd}
                accessibility={{ announcements: undefined }}
              >
                {/* SP mobile layout — always visible, no lg:hidden */}
                <div>
                  <MobileContentTabs
                    activeTab={mobileTab}
                    onTabChange={handleMobileTabChange}
                    candidateCount={dnd.localCandidates.length}
                  />
                  <div
                    ref={mobileContentRef}
                    className="min-h-[60vh] overflow-x-hidden touch-pan-y pb-20"
                  >
                    <div
                      ref={swipeContainerRef}
                      className="relative touch-pan-y will-change-transform"
                    >
                      {/* Current tab */}
                      <div
                        className={
                          tapTransitionRef.current
                            ? "animate-[tab-fade-in_150ms_ease-out]"
                            : undefined
                        }
                        ref={() => {
                          tapTransitionRef.current = false;
                        }}
                      >
                        <div
                          id={getMobileTabPanelId(mobileTab)}
                          role="tabpanel"
                          aria-labelledby={getMobileTabTriggerId(mobileTab)}
                        >
                          {renderTabContent(mobileTab)}
                        </div>
                      </div>

                      {/* Adjacent tab (rendered only during swipe) */}
                      {swipe.adjacent && adjacentTabId && (
                        <div
                          className="absolute top-0 left-0 w-full"
                          aria-hidden="true"
                          style={{
                            transform:
                              swipe.adjacent === "next" ? "translateX(100%)" : "translateX(-100%)",
                          }}
                        >
                          {renderTabContent(adjacentTabId)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </DndContext>

              <Fab
                onClick={() => {
                  if (mobileTab === "schedule") {
                    if (selectedDay === -1) {
                      setAddPollOptionOpen(true);
                    } else {
                      if (scheduleLimitReached) {
                        toast.error(scheduleLimitMessage);
                        return;
                      }
                      setAddScheduleOpen(true);
                    }
                  } else if (mobileTab === "candidates") setAddCandidateOpen(true);
                  else if (mobileTab === "expenses") setAddExpenseOpen(true);
                  else if (mobileTab === "souvenirs") setAddSouvenirOpen(true);
                }}
                label={
                  mobileTab === "schedule"
                    ? selectedDay === -1
                      ? "日程案追加"
                      : "予定を追加"
                    : mobileTab === "candidates"
                      ? "候補を追加"
                      : mobileTab === "souvenirs"
                        ? "お土産を追加"
                        : "費用を追加"
                }
                hidden={
                  !canEdit ||
                  !online ||
                  mobileTab === "bookmarks" ||
                  mobileTab === "activity" ||
                  (mobileTab === "schedule" &&
                    selectedDay === -1 &&
                    (!isOwnerRole(trip.role) || pollData?.status !== "open"))
                }
              />

              <AddPatternDialog patternOps={patternOps} />
              <RenamePatternDialog patternOps={patternOps} />
              <BatchDeleteDialog selection={selection} />
              <DeletePatternDialog patternOps={patternOps} />
              <OverwritePatternDialog
                patternOps={patternOps}
                patterns={currentDay?.patterns ?? []}
              />
              <BookmarkListPickerDialog
                open={bookmarkPickerOpen}
                onOpenChange={setBookmarkPickerOpen}
                onSelect={handleBookmarkListSelected}
              />
            </div>
          </SelectionProvider>
        </MapsProvider>
      )}
    </LoadingBoundary>
  );
}

function MapsProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  if (!enabled) return <>{children}</>;
  return (
    <APIProvider
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
      libraries={["places", "geometry"]}
    >
      {children}
    </APIProvider>
  );
}
