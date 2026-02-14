"use client";

import { type Announcements, DndContext, DragOverlay } from "@dnd-kit/core";
import type { DayPatternResponse, TripResponse } from "@sugara/shared";
import {
  DAY_MEMO_MAX_LENGTH,
  MAX_MEMBERS_PER_TRIP,
  MAX_PATTERNS_PER_DAY,
  MAX_SCHEDULES_PER_TRIP,
  PATTERN_LABEL_MAX_LENGTH,
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
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { ActivityLog } from "@/components/activity-log";
import { CandidatePanel } from "@/components/candidate-panel";
import { DayTimeline } from "@/components/day-timeline";
import { EditTripDialog } from "@/components/edit-trip-dialog";
import { hashColor, PresenceAvatars } from "@/components/presence-avatars";
import { ScrollToTop } from "@/components/scroll-to-top";
import type { ShortcutGroup } from "@/components/shortcut-help-dialog";
import { TripActions } from "@/components/trip-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { SCHEDULE_COLOR_CLASSES } from "@/lib/colors";
import { getCrossDayEntries } from "@/lib/cross-day";
import { formatDateRange, getDayCount, getTimeStatus, toDateString } from "@/lib/format";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useCurrentTime } from "@/lib/hooks/use-current-time";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { useScheduleSelection } from "@/lib/hooks/use-schedule-selection";
import { useTripDragAndDrop } from "@/lib/hooks/use-trip-drag-and-drop";
import { useTripSync } from "@/lib/hooks/use-trip-sync";
import { CATEGORY_ICONS } from "@/lib/icons";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { useRegisterShortcuts, useShortcutHelp } from "@/lib/shortcut-help-context";
import { useDelayedLoading } from "@/lib/use-delayed-loading";
import { cn } from "@/lib/utils";

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
  const [addPatternOpen, setAddPatternOpen] = useState(false);
  const [addPatternLabel, setAddPatternLabel] = useState("");
  const [addPatternLoading, setAddPatternLoading] = useState(false);
  const [deletePatternTarget, setDeletePatternTarget] = useState<DayPatternResponse | null>(null);
  const [renamePattern, setRenamePattern] = useState<DayPatternResponse | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"candidates" | "activity">("candidates");
  const [editingMemo, setEditingMemo] = useState<string | null>(null);
  const [memoText, setMemoText] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);
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
    () => (session?.user ? { id: session.user.id, name: session.user.name } : null),
    [session?.user],
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

  // Auto-transition: planned → active (first spot starts), active → completed (all spots done)
  const autoTransitionTriggered = useRef(false);
  useEffect(() => {
    autoTransitionTriggered.current = false;
  }, [trip?.status]);

  useEffect(() => {
    if (!trip || autoTransitionTriggered.current) return;
    // Only owner/editor can change status; skip for viewer to avoid infinite retry
    if (trip.role === "viewer") return;

    const todayStr = toDateString(new Date());

    let nextStatus: string | null = null;
    let message = "";

    if (trip.status === "planned") {
      let shouldActivate = false;
      if (todayStr > trip.startDate) {
        shouldActivate = true;
      } else if (todayStr === trip.startDate) {
        const todaySchedules = trip.days
          .filter((d) => d.date === todayStr)
          .flatMap((d) => d.patterns.flatMap((p) => p.schedules));
        shouldActivate = todaySchedules.some(
          (spot) => getTimeStatus(now, spot.startTime, spot.endTime) !== "future",
        );
      }
      if (shouldActivate) {
        nextStatus = "active";
        message = MSG.TRIP_AUTO_IN_PROGRESS;
      }
    } else if (trip.status === "active") {
      let allDone = false;
      if (todayStr > trip.endDate) {
        allDone = true;
      } else if (todayStr === trip.endDate) {
        const todaySchedules = trip.days
          .filter((d) => d.date === todayStr)
          .flatMap((d) => d.patterns.flatMap((p) => p.schedules));
        if (todaySchedules.length > 0) {
          allDone = todaySchedules.every(
            (spot) => getTimeStatus(now, spot.startTime, spot.endTime) === "past",
          );
        }
      }
      if (allDone) {
        nextStatus = "completed";
        message = MSG.TRIP_AUTO_COMPLETED;
      }
    }

    if (nextStatus) {
      autoTransitionTriggered.current = true;
      api(`/api/trips/${tripId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      })
        .then(() => {
          toast.success(message);
          onMutate();
        })
        .catch(() => {
          autoTransitionTriggered.current = false;
        });
    }
  }, [trip, now, tripId, onMutate]);

  // Stable references to avoid infinite re-render when values are null
  const dndSchedules = useMemo(() => currentPattern?.schedules ?? [], [currentPattern?.schedules]);
  const dndCandidates = useMemo(() => trip?.candidates ?? [], [trip?.candidates]);
  const dndCrossDayEntries = useMemo(
    () => (currentDay && trip ? getCrossDayEntries(trip.days, currentDay.dayNumber) : undefined),
    [currentDay, trip],
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

  async function handleAddPattern(e: React.FormEvent) {
    e.preventDefault();
    if (!currentDay || !addPatternLabel.trim()) return;
    setAddPatternLoading(true);
    try {
      await api(`/api/trips/${tripId}/days/${currentDay.id}/patterns`, {
        method: "POST",
        body: JSON.stringify({ label: addPatternLabel.trim() }),
      });
      toast.success(MSG.PATTERN_ADDED);
      setAddPatternOpen(false);
      setAddPatternLabel("");
      onMutate();
    } catch {
      toast.error(MSG.PATTERN_ADD_FAILED);
    } finally {
      setAddPatternLoading(false);
    }
  }

  async function handleDuplicatePattern(patternId: string) {
    if (!currentDay) return;
    try {
      await api(`/api/trips/${tripId}/days/${currentDay.id}/patterns/${patternId}/duplicate`, {
        method: "POST",
      });
      toast.success(MSG.PATTERN_DUPLICATED);
      onMutate();
    } catch {
      toast.error(MSG.PATTERN_DUPLICATE_FAILED);
    }
  }

  async function handleDeletePattern(patternId: string) {
    if (!currentDay) return;
    try {
      await api(`/api/trips/${tripId}/days/${currentDay.id}/patterns/${patternId}`, {
        method: "DELETE",
      });
      toast.success(MSG.PATTERN_DELETED);
      // Reset to first pattern
      setSelectedPattern((prev) => ({ ...prev, [currentDay.id]: 0 }));
      onMutate();
    } catch {
      toast.error(MSG.PATTERN_DELETE_FAILED);
    }
  }

  async function handleRenamePattern(e: React.FormEvent) {
    e.preventDefault();
    if (!currentDay || !renamePattern || !renameLabel.trim()) return;
    setRenameLoading(true);
    try {
      await api(`/api/trips/${tripId}/days/${currentDay.id}/patterns/${renamePattern.id}`, {
        method: "PATCH",
        body: JSON.stringify({ label: renameLabel.trim() }),
      });
      toast.success(MSG.PATTERN_RENAMED);
      setRenamePattern(null);
      setRenameLabel("");
      onMutate();
    } catch {
      toast.error(MSG.PATTERN_RENAME_FAILED);
    } finally {
      setRenameLoading(false);
    }
  }

  function startMemoEdit(dayId: string, currentMemo: string | null | undefined) {
    setEditingMemo(dayId);
    setMemoText(currentMemo ?? "");
  }

  function cancelMemoEdit() {
    setEditingMemo(null);
    setMemoText("");
  }

  async function handleSaveMemo() {
    if (!currentDay || editingMemo !== currentDay.id) return;
    setMemoSaving(true);
    try {
      await api(`/api/trips/${tripId}/days/${currentDay.id}`, {
        method: "PATCH",
        body: JSON.stringify({ memo: memoText.trim() || null }),
      });
      toast.success(MSG.DAY_MEMO_UPDATED);
      setEditingMemo(null);
      setMemoText("");
      onMutate();
    } catch {
      toast.error(MSG.DAY_MEMO_UPDATE_FAILED);
    } finally {
      setMemoSaving(false);
    }
  }

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

  return (
    <div className="mt-4">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{trip.title}</h1>
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
          onDragEnd={dnd.handleDragEnd}
          accessibility={{ announcements: dndAnnouncements }}
        >
          <div className="flex gap-4">
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
                  {editingMemo === currentDay.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={memoText}
                        onChange={(e) => setMemoText(e.target.value)}
                        placeholder="メモを入力..."
                        maxLength={DAY_MEMO_MAX_LENGTH}
                        rows={3}
                        className="resize-none text-sm"
                        autoFocus
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {memoText.length}/{DAY_MEMO_MAX_LENGTH}
                        </span>
                        <div className="flex gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelMemoEdit}
                            disabled={memoSaving}
                          >
                            キャンセル
                          </Button>
                          <Button size="sm" onClick={handleSaveMemo} disabled={memoSaving}>
                            <Check className="h-3.5 w-3.5" />
                            {memoSaving ? "保存中..." : "保存"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        canEdit && online
                          ? startMemoEdit(currentDay.id, currentDay.memo)
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
                      <span className="whitespace-pre-wrap">{currentDay.memo || "メモを追加"}</span>
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
                  selectionMode={selection.selectionTarget === "timeline"}
                  selectedIds={
                    selection.selectionTarget === "timeline" ? selection.selectedIds : undefined
                  }
                  onToggleSelect={selection.toggle}
                  onEnterSelectionMode={
                    canEdit && online ? () => selection.enter("timeline") : undefined
                  }
                  onExitSelectionMode={selection.exit}
                  onSelectAll={selection.selectAll}
                  onDeselectAll={selection.deselectAll}
                  onBatchUnassign={selection.batchUnassign}
                  onBatchDuplicate={selection.batchDuplicateSchedules}
                  onBatchDelete={() => selection.setBatchDeleteOpen(true)}
                  batchLoading={selection.batchLoading}
                  scheduleLimitReached={scheduleLimitReached}
                  scheduleLimitMessage={scheduleLimitMessage}
                  headerContent={
                    <div className="mb-3 flex flex-wrap select-none items-center gap-1.5">
                      {currentDay.patterns.map((pattern, index) => {
                        const isActive = currentPatternIndex === index;
                        return (
                          <div
                            key={pattern.id}
                            className={cn(
                              "flex shrink-0 items-center rounded-full border transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-1",
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
                                "py-1.5 text-xs font-medium focus:outline-none",
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
                                    onClick={() => {
                                      setRenamePattern(pattern);
                                      setRenameLabel(pattern.label);
                                    }}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    名前変更
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDuplicatePattern(pattern.id)}
                                    disabled={currentDay.patterns.length >= MAX_PATTERNS_PER_DAY}
                                  >
                                    <Copy className="mr-2 h-4 w-4" />
                                    複製
                                  </DropdownMenuItem>
                                  {!pattern.isDefault && (
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setDeletePatternTarget(pattern)}
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
                            onClick={() => setAddPatternOpen(true)}
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
            <div className="hidden max-h-[calc(100vh-8rem)] sm:max-h-[calc(100vh-12rem)] lg:flex flex-[2] flex-col rounded-lg border border-dashed bg-card self-start sticky top-4">
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
                    currentPatternId={currentPattern.id}
                    onRefresh={onMutate}
                    disabled={!online || !canEdit}
                    draggable={canEdit && online}
                    addDialogOpen={addCandidateOpen}
                    onAddDialogOpenChange={setAddCandidateOpen}
                    selectionMode={selection.selectionTarget === "candidates"}
                    selectedIds={
                      selection.selectionTarget === "candidates" ? selection.selectedIds : undefined
                    }
                    onToggleSelect={selection.toggle}
                    onEnterSelectionMode={
                      canEdit && online ? () => selection.enter("candidates") : undefined
                    }
                    onExitSelectionMode={selection.exit}
                    onSelectAll={selection.selectAll}
                    onDeselectAll={selection.deselectAll}
                    onBatchAssign={selection.batchAssign}
                    onBatchDuplicate={selection.batchDuplicateCandidates}
                    onBatchDelete={() => selection.setBatchDeleteOpen(true)}
                    batchLoading={selection.batchLoading}
                    scheduleLimitReached={scheduleLimitReached}
                    scheduleLimitMessage={scheduleLimitMessage}
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

      {/* Add pattern dialog */}
      <Dialog
        open={addPatternOpen}
        onOpenChange={(open) => {
          setAddPatternOpen(open);
          if (!open) setAddPatternLabel("");
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>パターン追加</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPattern} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pattern-label">ラベル</Label>
              <Input
                id="pattern-label"
                value={addPatternLabel}
                onChange={(e) => setAddPatternLabel(e.target.value)}
                placeholder="例: 雨の日プラン"
                maxLength={PATTERN_LABEL_MAX_LENGTH}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addPatternLoading || !addPatternLabel.trim()}>
                <Plus className="h-4 w-4" />
                {addPatternLoading ? "追加中..." : "追加"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mobile candidate / activity dialog */}
      <Dialog open={candidateOpen} onOpenChange={setCandidateOpen}>
        <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden sm:max-w-sm">
          <DialogTitle className="sr-only">候補・履歴</DialogTitle>
          <div className="flex shrink-0 select-none border-b" role="tablist">
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
          <div className="min-h-0 overflow-y-auto">
            {rightPanelTab === "candidates" ? (
              currentDay &&
              currentPattern && (
                <CandidatePanel
                  tripId={tripId}
                  candidates={dnd.localCandidates}
                  currentPatternId={currentPattern.id}
                  onRefresh={onMutate}
                  disabled={!online || !canEdit}
                  draggable={false}
                  selectionMode={selection.selectionTarget === "candidates"}
                  selectedIds={
                    selection.selectionTarget === "candidates" ? selection.selectedIds : undefined
                  }
                  onToggleSelect={selection.toggle}
                  onEnterSelectionMode={
                    canEdit && online ? () => selection.enter("candidates") : undefined
                  }
                  onExitSelectionMode={selection.exit}
                  onSelectAll={selection.selectAll}
                  onDeselectAll={selection.deselectAll}
                  onBatchAssign={selection.batchAssign}
                  onBatchDuplicate={selection.batchDuplicateCandidates}
                  onBatchDelete={() => selection.setBatchDeleteOpen(true)}
                  batchLoading={selection.batchLoading}
                  scheduleLimitReached={scheduleLimitReached}
                  scheduleLimitMessage={scheduleLimitMessage}
                />
              )
            ) : (
              <div className="p-4">
                <ActivityLog tripId={tripId} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename pattern dialog */}
      <Dialog
        open={renamePattern !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenamePattern(null);
            setRenameLabel("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>パターン名変更</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenamePattern} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-label">ラベル</Label>
              <Input
                id="rename-label"
                value={renameLabel}
                onChange={(e) => setRenameLabel(e.target.value)}
                maxLength={PATTERN_LABEL_MAX_LENGTH}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={renameLoading || !renameLabel.trim()}>
                <Check className="h-4 w-4" />
                {renameLoading ? "変更中..." : "変更"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Batch delete confirmation dialog */}
      <AlertDialog open={selection.batchDeleteOpen} onOpenChange={selection.setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selection.selectedIds.size}件を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              選択した{selection.selectedIds.size}件を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={selection.batchDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={selection.batchLoading}
            >
              <Trash2 className="h-4 w-4" />
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Pattern delete confirmation dialog */}
      <AlertDialog
        open={deletePatternTarget !== null}
        onOpenChange={(v) => !v && setDeletePatternTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>パターンを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deletePatternTarget?.label}
              」とその中のすべての予定を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletePatternTarget) handleDeletePattern(deletePatternTarget.id);
                setDeletePatternTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
