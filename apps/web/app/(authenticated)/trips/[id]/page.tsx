"use client";

import { type Announcements, DndContext, DragOverlay } from "@dnd-kit/core";
import type { TripResponse } from "@sugara/shared";
import {
  DAY_MEMO_MAX_LENGTH,
  MAX_MEMBERS_PER_TRIP,
  MAX_PATTERNS_PER_DAY,
  MAX_SCHEDULES_PER_TRIP,
} from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  List,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { ActivityLog } from "@/components/activity-log";
import { BookmarkListPickerDialog } from "@/components/bookmark-list-picker-dialog";
import { BookmarkPanel } from "@/components/bookmark-panel";
import { CandidatePanel } from "@/components/candidate-panel";
import { DayTimeline } from "@/components/day-timeline";

const EditTripDialog = dynamic(() =>
  import("@/components/edit-trip-dialog").then((mod) => mod.EditTripDialog),
);

import { hashColor, PresenceAvatars } from "@/components/presence-avatars";
import { ScrollToTop } from "@/components/scroll-to-top";
import type { ShortcutGroup } from "@/components/shortcut-help-dialog";
import { TripActions } from "@/components/trip-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, getApiErrorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { SCHEDULE_COLOR_CLASSES } from "@/lib/colors";
import { getCrossDayEntries } from "@/lib/cross-day";
import { formatDateRange, getDayCount } from "@/lib/format";
import { SelectionProvider } from "@/lib/hooks/selection-context";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useAutoStatusTransition } from "@/lib/hooks/use-auto-status-transition";
import { useCurrentTime } from "@/lib/hooks/use-current-time";
import { useDayMemo } from "@/lib/hooks/use-day-memo";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { usePatternOperations } from "@/lib/hooks/use-pattern-operations";
import { useScheduleSelection } from "@/lib/hooks/use-schedule-selection";
import { useTripDragAndDrop } from "@/lib/hooks/use-trip-drag-and-drop";
import { useTripSync } from "@/lib/hooks/use-trip-sync";
import { CATEGORY_ICONS } from "@/lib/icons";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { useRegisterShortcuts, useShortcutHelp } from "@/lib/shortcut-help-context";
import { cn } from "@/lib/utils";
import {
  AddPatternDialog,
  BatchDeleteDialog,
  DeletePatternDialog,
  MobileCandidateDialog,
  RenamePatternDialog,
} from "./_components/trip-dialogs";

const dndAnnouncements: Announcements = {
  onDragStart({ active }) {
    return `${active.id} を持ち上げました`;
  },
  onDragOver({ active, over }) {
    if (over) return `${active.id} を ${over.id} の上に移動中`;
    return `${active.id} をドラッグ中`;
  },
  onDragEnd({ active, over }) {
    if (over) return `${active.id} を ${over.id} の位置にドロップしました`;
    return `${active.id} をドロップしました`;
  },
  onDragCancel({ active }) {
    return `${active.id} のドラッグをキャンセルしました`;
  },
};

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.id as string;
  const online = useOnlineStatus();
  const now = useCurrentTime();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const {
    data: trip = null,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.trips.detail(tripId),
    queryFn: () => api<TripResponse>(`/api/trips/${tripId}`),
  });
  useAuthRedirect(queryError);
  const showSkeleton = useDelayedLoading(isLoading);

  const [editOpen, setEditOpen] = useState(false);
  const [addScheduleOpen, setAddScheduleOpen] = useState(false);
  const [addCandidateOpen, setAddCandidateOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedPattern, setSelectedPattern] = useState<Record<string, number>>({});
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"candidates" | "activity" | "bookmarks">(
    "candidates",
  );
  const [saveToBookmarkIds, setSaveToBookmarkIds] = useState<string[]>([]);
  const [bookmarkPickerOpen, setBookmarkPickerOpen] = useState(false);
  const timelinePanelRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts
  const { open: openShortcutHelp } = useShortcutHelp();
  const tripShortcuts: ShortcutGroup[] = useMemo(
    () => [
      {
        group: "ナビゲーション",
        items: [
          { key: "1-9", description: "N日目に切替" },
          { key: "[", description: "前の日へ" },
          { key: "]", description: "次の日へ" },
        ],
      },
      {
        group: "操作",
        items: [
          { key: "a", description: "予定を追加" },
          { key: "c", description: "候補を追加" },
          { key: "e", description: "旅行を編集" },
        ],
      },
    ],
    [],
  );
  useRegisterShortcuts(tripShortcuts);
  useHotkeys("?", () => openShortcutHelp(), { useKey: true, preventDefault: true });
  useHotkeys("1,2,3,4,5,6,7,8,9", (e) => {
    const dayIndex = Number(e.key) - 1;
    if (trip && dayIndex < trip.days.length) {
      setSelectedDay(dayIndex);
    }
  });
  useHotkeys("[", () => setSelectedDay((prev) => Math.max(0, prev - 1)), { useKey: true });
  useHotkeys(
    "]",
    () => {
      if (trip) {
        setSelectedDay((prev) => Math.min(trip.days.length - 1, prev + 1));
      }
    },
    { useKey: true },
  );
  useHotkeys(
    "a",
    () => {
      if (canEditRef.current && online) setAddScheduleOpen(true);
    },
    { preventDefault: true },
  );
  useHotkeys(
    "c",
    () => {
      if (canEditRef.current && online) setAddCandidateOpen(true);
    },
    { preventDefault: true },
  );
  useHotkeys(
    "e",
    () => {
      if (canEditRef.current) setEditOpen(true);
    },
    { preventDefault: true },
  );

  // Stable ref for canEdit to avoid re-registering hotkeys on every trip change
  const canEditRef = useRef(false);

  const invalidateTrip = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) }),
    [queryClient, tripId],
  );

  const syncUser = useMemo(
    () =>
      session?.user
        ? { id: session.user.id, name: session.user.name, image: session.user.image }
        : null,
    [session?.user?.id, session?.user?.name, session?.user?.image],
  );
  const { presence, isConnected, updatePresence, broadcastChange } = useTripSync(
    tripId,
    syncUser,
    invalidateTrip,
  );

  // Mutation callback: refetch + broadcast to other clients
  const onMutate = useCallback(async () => {
    await invalidateTrip();
    broadcastChange();
    await queryClient.invalidateQueries({ queryKey: queryKeys.trips.activityLogs(tripId) });
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

  useEffect(() => {
    if (trip) {
      document.title = `${trip.title} - sugara`;
    }
  }, [trip?.title]);

  const currentDay = trip?.days[selectedDay] ?? null;
  const currentPatternIndex = currentDay ? (selectedPattern[currentDay.id] ?? 0) : 0;
  const currentPattern = currentDay?.patterns[currentPatternIndex] ?? null;

  // Exclude self from presence display
  const otherPresence = useMemo(
    () => (session?.user ? presence.filter((u) => u.userId !== session.user.id) : presence),
    [presence, session?.user],
  );

  useEffect(() => {
    if (currentDay) {
      updatePresence(currentDay.id, currentPattern?.id ?? null);
    }
  }, [currentDay?.id, currentPattern?.id, updatePresence]);

  useAutoStatusTransition({ trip, tripId, now, onMutate });

  // Stable references to avoid infinite re-render when values are null
  const dndSchedules = useMemo(() => currentPattern?.schedules ?? [], [currentPattern?.schedules]);
  const dndCandidates = useMemo(() => trip?.candidates ?? [], [trip?.candidates]);
  const dndCrossDayEntries = useMemo(
    () => (currentDay && trip ? getCrossDayEntries(trip.days, currentDay.dayNumber) : undefined),
    [currentDay?.dayNumber, trip?.days],
  );

  const dnd = useTripDragAndDrop({
    tripId,
    currentDayId: currentDay?.id ?? null,
    currentPatternId: currentPattern?.id ?? null,
    schedules: dndSchedules,
    candidates: dndCandidates,
    crossDayEntries: dndCrossDayEntries,
    onDone: onMutate,
  });

  const patternOps = usePatternOperations({
    tripId,
    currentDayId: currentDay?.id ?? null,
    onDone: onMutate,
    onPatternDeleted: (dayId) => setSelectedPattern((prev) => ({ ...prev, [dayId]: 0 })),
  });

  const memo = useDayMemo({
    tripId,
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
    tripId,
    currentDayId: currentDay?.id ?? null,
    currentPatternId: currentPattern?.id ?? null,
    timelineScheduleIds,
    candidateIds,
    onDone: onMutate,
  });

  if (showSkeleton) {
    return (
      <div className="mt-4">
        <div className="mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex max-h-[calc(100vh-8rem)] sm:max-h-[calc(100vh-12rem)] min-w-0 flex-[3] flex-col rounded-lg border bg-card">
            <div className="flex shrink-0 gap-1 px-4 py-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-5 w-14" />
              ))}
              <Skeleton className="ml-auto h-5 w-10" />
            </div>
            <div className="p-4">
              <div className="mb-3 flex items-center gap-1.5">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-full" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-12 rounded-full" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="hidden flex-[2] self-start sticky top-4 rounded-lg border border-dashed bg-card p-4 lg:block">
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Avoid flashing "not found" during the 200ms skeleton delay
  if (isLoading) return null;

  if (queryError || !trip) {
    return <p className="text-destructive">{MSG.TRIP_FETCH_FAILED}</p>;
  }

  const canEdit = trip.role === "owner" || trip.role === "editor";
  canEditRef.current = canEdit;
  const dayCount = getDayCount(trip.startDate, trip.endDate);

  const scheduleLimitReached = trip.scheduleCount >= MAX_SCHEDULES_PER_TRIP;
  const scheduleLimitMessage = MSG.LIMIT_SCHEDULES;
  const selectionValue = { ...selection, canEnter: canEdit && online };

  return (
    <SelectionProvider value={selectionValue}>
      <div className="mt-4">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="min-w-0 truncate text-2xl font-bold">{trip.title}</h1>
            <PresenceAvatars users={otherPresence} isConnected={isConnected} />
          </div>
          <p className="text-muted-foreground">
            {`${trip.destination} / `}
            {formatDateRange(trip.startDate, trip.endDate)}
            <span className="ml-2 text-sm">({dayCount}日間)</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TripActions
              tripId={tripId}
              status={trip.status}
              role={trip.role}
              onStatusChange={onMutate}
              onEdit={canEdit ? () => setEditOpen(true) : undefined}
              disabled={!online}
              memberLimitReached={trip.memberCount >= MAX_MEMBERS_PER_TRIP}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCandidateOpen(true)}
              className="ml-auto lg:hidden"
            >
              <List className="h-4 w-4" />
              <span>候補</span>
              {dnd.localCandidates.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 text-xs">
                  {dnd.localCandidates.length}
                </span>
              )}
            </Button>
          </div>
        </div>
        <EditTripDialog
          tripId={tripId}
          title={trip.title}
          destination={trip.destination}
          startDate={trip.startDate}
          endDate={trip.endDate}
          open={editOpen}
          onOpenChange={setEditOpen}
          onUpdate={onMutate}
        />
        {currentDay && currentPattern && (
          <DndContext
            sensors={dnd.sensors}
            collisionDetection={dnd.collisionDetection}
            onDragStart={dnd.handleDragStart}
            onDragOver={dnd.handleDragOver}
            onDragEnd={dnd.handleDragEnd}
            accessibility={{ announcements: dndAnnouncements }}
          >
            <div className="flex items-start gap-4">
              {/* Timeline */}
              <div className="flex min-w-0 max-h-[calc(100vh-8rem)] sm:max-h-[calc(100vh-12rem)] flex-[3] flex-col rounded-lg border bg-card">
                <div
                  className="flex shrink-0 select-none border-b"
                  role="tablist"
                  aria-label="日程タブ"
                >
                  <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-4">
                    {trip.days.map((day, index) => (
                      <button
                        key={day.id}
                        type="button"
                        role="tab"
                        aria-selected={selectedDay === index}
                        aria-controls={`day-panel-${day.id}`}
                        onClick={() => setSelectedDay(index)}
                        className={cn(
                          "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors",
                          selectedDay === index
                            ? "text-blue-600 dark:text-blue-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {day.dayNumber}日目
                        {otherPresence
                          .filter((u) => u.dayId === day.id)
                          .slice(0, 3)
                          .map((u, i) => (
                            <span
                              key={u.userId}
                              className={cn(
                                "absolute top-1 h-1.5 w-1.5 rounded-full",
                                hashColor(u.userId),
                              )}
                              style={{ right: `${4 + i * 6}px` }}
                            />
                          ))}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  ref={timelinePanelRef}
                  id={`day-panel-${currentDay.id}`}
                  role="tabpanel"
                  className="min-h-0 overflow-y-auto p-4"
                >
                  {/* Day memo */}
                  <div className="mb-3">
                    {memo.editingDayId === currentDay.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={memo.text}
                          onChange={(e) => memo.setText(e.target.value)}
                          placeholder="メモを入力..."
                          maxLength={DAY_MEMO_MAX_LENGTH}
                          rows={3}
                          className="resize-none text-sm"
                          autoFocus
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {memo.text.length}/{DAY_MEMO_MAX_LENGTH}
                          </span>
                          <div className="flex gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={memo.cancelEdit}
                              disabled={memo.saving}
                            >
                              キャンセル
                            </Button>
                            <Button size="sm" onClick={memo.save} disabled={memo.saving}>
                              <Check className="h-3.5 w-3.5" />
                              {memo.saving ? "保存中..." : "保存"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          canEdit && online
                            ? memo.startEdit(currentDay.id, currentDay.memo)
                            : undefined
                        }
                        className={cn(
                          "flex w-full select-none items-start gap-2 rounded-md border border-dashed px-3 py-2 text-left text-sm transition-colors",
                          canEdit && online
                            ? "cursor-pointer hover:border-border hover:bg-muted/50"
                            : "cursor-default",
                          currentDay.memo
                            ? "border-border text-foreground"
                            : "border-muted-foreground/20 text-muted-foreground",
                        )}
                      >
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-pre-wrap">
                          {currentDay.memo || "メモを追加"}
                        </span>
                      </button>
                    )}
                  </div>

                  <DayTimeline
                    key={currentPattern.id}
                    tripId={tripId}
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
                    headerContent={
                      <div className="mb-3 flex flex-wrap select-none items-center gap-1.5">
                        {currentDay.patterns.map((pattern, index) => {
                          const isActive = currentPatternIndex === index;
                          return (
                            <div
                              key={pattern.id}
                              className={cn(
                                "flex max-w-48 items-center rounded-full border transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-1",
                                isActive
                                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
                                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                              )}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedPattern((prev) => ({
                                    ...prev,
                                    [currentDay.id]: index,
                                  }))
                                }
                                className={cn(
                                  "truncate py-1.5 text-xs font-medium focus:outline-none",
                                  canEdit ? "pl-3 pr-0.5" : "px-3",
                                )}
                              >
                                {pattern.label}
                              </button>
                              {canEdit && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none sm:h-6 sm:w-6"
                                      aria-label={`${pattern.label}のメニュー`}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start">
                                    <DropdownMenuItem
                                      onClick={() => patternOps.rename.start(pattern)}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      名前変更
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => patternOps.handleDuplicate(pattern.id)}
                                      disabled={currentDay.patterns.length >= MAX_PATTERNS_PER_DAY}
                                    >
                                      <Copy className="mr-2 h-4 w-4" />
                                      複製
                                    </DropdownMenuItem>
                                    {!pattern.isDefault && (
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => patternOps.setDeleteTarget(pattern)}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        削除
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          );
                        })}
                        {canEdit &&
                          online &&
                          (currentDay.patterns.length >= MAX_PATTERNS_PER_DAY ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <button
                                    type="button"
                                    disabled
                                    className="shrink-0 cursor-not-allowed rounded-full border border-dashed border-muted-foreground/20 px-3 py-1.5 text-xs text-muted-foreground/50"
                                  >
                                    <Plus className="inline h-3 w-3" /> パターン追加
                                  </button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{MSG.LIMIT_PATTERNS}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <button
                              type="button"
                              onClick={() => patternOps.add.setOpen(true)}
                              className="shrink-0 rounded-full border border-dashed border-muted-foreground/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
                            >
                              <Plus className="inline h-3 w-3" /> パターン追加
                            </button>
                          ))}
                      </div>
                    }
                  />
                  <ScrollToTop containerRef={timelinePanelRef} />
                </div>
              </div>

              {/* Candidates / Activity */}
              <div className="hidden max-h-[calc(100vh-8rem)] sm:max-h-[calc(100vh-12rem)] lg:flex min-w-0 flex-[2] flex-col rounded-lg border border-dashed bg-card self-start sticky top-4">
                <div
                  className="flex shrink-0 select-none border-b"
                  role="tablist"
                  aria-label="候補・履歴タブ"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={rightPanelTab === "candidates"}
                    onClick={() => setRightPanelTab("candidates")}
                    className={cn(
                      "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors",
                      rightPanelTab === "candidates"
                        ? "text-blue-600 dark:text-blue-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    候補
                    {dnd.localCandidates.length > 0 && (
                      <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">
                        {dnd.localCandidates.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={rightPanelTab === "bookmarks"}
                    onClick={() => setRightPanelTab("bookmarks")}
                    className={cn(
                      "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors",
                      rightPanelTab === "bookmarks"
                        ? "text-blue-600 dark:text-blue-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    ブックマーク
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={rightPanelTab === "activity"}
                    onClick={() => setRightPanelTab("activity")}
                    className={cn(
                      "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors",
                      rightPanelTab === "activity"
                        ? "text-blue-600 dark:text-blue-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    履歴
                  </button>
                </div>
                <div className="min-h-0 overflow-y-auto p-4">
                  {rightPanelTab === "candidates" ? (
                    <CandidatePanel
                      tripId={tripId}
                      candidates={dnd.localCandidates}
                      currentDayId={currentDay.id}
                      currentPatternId={currentPattern.id}
                      onRefresh={onMutate}
                      disabled={!online || !canEdit}
                      draggable={canEdit && online}
                      addDialogOpen={addCandidateOpen}
                      onAddDialogOpenChange={setAddCandidateOpen}
                      scheduleLimitReached={scheduleLimitReached}
                      scheduleLimitMessage={scheduleLimitMessage}
                      overCandidateId={dnd.activeDragItem ? dnd.overCandidateId : null}
                      maxEndDayOffset={Math.max(0, trip.days.length - 1)}
                      onSaveToBookmark={canEdit && online ? handleSaveToBookmark : undefined}
                    />
                  ) : rightPanelTab === "bookmarks" ? (
                    <BookmarkPanel
                      tripId={tripId}
                      disabled={!online || !canEdit}
                      onCandidateAdded={onMutate}
                    />
                  ) : (
                    <ActivityLog tripId={tripId} />
                  )}
                </div>
              </div>
            </div>
            <DragOverlay>
              {dnd.activeDragItem &&
                (() => {
                  const Icon = CATEGORY_ICONS[dnd.activeDragItem.category];
                  const colorClasses = SCHEDULE_COLOR_CLASSES[dnd.activeDragItem.color];
                  return (
                    <div className="flex items-center gap-2 rounded-md border bg-card p-2 shadow-lg opacity-90">
                      <div
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white",
                          colorClasses.bg,
                        )}
                      >
                        <Icon className="h-3 w-3" />
                      </div>
                      <span className="text-sm font-medium">{dnd.activeDragItem.name}</span>
                    </div>
                  );
                })()}
            </DragOverlay>
          </DndContext>
        )}

        <AddPatternDialog patternOps={patternOps} />
        <MobileCandidateDialog
          open={candidateOpen}
          onOpenChange={setCandidateOpen}
          rightPanelTab={rightPanelTab}
          setRightPanelTab={setRightPanelTab}
          tripId={tripId}
          candidates={dnd.localCandidates}
          currentDay={currentDay}
          currentPatternId={currentPattern?.id ?? null}
          onRefresh={onMutate}
          disabled={!online || !canEdit}
          scheduleLimitReached={scheduleLimitReached}
          scheduleLimitMessage={scheduleLimitMessage}
          maxEndDayOffset={Math.max(0, trip.days.length - 1)}
          onSaveToBookmark={canEdit && online ? handleSaveToBookmark : undefined}
        />
        <RenamePatternDialog patternOps={patternOps} />
        <BatchDeleteDialog selection={selection} />
        <DeletePatternDialog patternOps={patternOps} />
        <BookmarkListPickerDialog
          open={bookmarkPickerOpen}
          onOpenChange={setBookmarkPickerOpen}
          onSelect={handleBookmarkListSelected}
        />
      </div>
    </SelectionProvider>
  );
}
