"use client";

import { type Announcements, DndContext, DragOverlay } from "@dnd-kit/core";
import type { DayPatternResponse, TripResponse } from "@sugara/shared";
import { PATTERN_LABEL_MAX_LENGTH } from "@sugara/shared";
import { ChevronDown, Copy, List, Pencil, Plus, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CandidatePanel } from "@/components/candidate-panel";
import { DayTimeline } from "@/components/day-timeline";
import { EditTripDialog } from "@/components/edit-trip-dialog";
import { hashColor, PresenceAvatars } from "@/components/presence-avatars";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { SCHEDULE_COLOR_CLASSES } from "@/lib/colors";
import { getCrossDayEntries } from "@/lib/cross-day";
import { formatDateRange, getDayCount, getTimeStatus, toDateString } from "@/lib/format";
import { useCurrentTime } from "@/lib/hooks/use-current-time";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { useScheduleSelection } from "@/lib/hooks/use-schedule-selection";
import { useTripDragAndDrop } from "@/lib/hooks/use-trip-drag-and-drop";
import { useTripSync } from "@/lib/hooks/use-trip-sync";
import { CATEGORY_ICONS } from "@/lib/icons";
import { MSG } from "@/lib/messages";
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
  const router = useRouter();
  const tripId = params.id as string;
  const online = useOnlineStatus();
  const now = useCurrentTime();
  const { data: session } = useSession();
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedPattern, setSelectedPattern] = useState<Record<string, number>>({});
  const [addPatternOpen, setAddPatternOpen] = useState(false);
  const [addPatternLabel, setAddPatternLabel] = useState("");
  const [addPatternLoading, setAddPatternLoading] = useState(false);
  const [renamePattern, setRenamePattern] = useState<DayPatternResponse | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [candidateOpen, setCandidateOpen] = useState(false);

  // Defined before fetchTrip so it can be passed to useTripSync below
  const fetchTripRef = useRef<() => void>(() => {});
  const fetchInFlightRef = useRef(false);
  const fetchPendingRef = useRef(false);

  const syncUser = useMemo(
    () => (session?.user ? { id: session.user.id, name: session.user.name } : null),
    [session?.user],
  );
  const { presence, isConnected, updatePresence, broadcastChange } = useTripSync(
    tripId,
    syncUser,
    () => fetchTripRef.current(),
  );

  const fetchTrip = useCallback(async () => {
    if (fetchInFlightRef.current) {
      fetchPendingRef.current = true;
      return;
    }
    fetchInFlightRef.current = true;
    fetchPendingRef.current = false;
    try {
      const data = await api<TripResponse>(`/api/trips/${tripId}`);
      setTrip(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/auth/login");
        return;
      }
      setError(MSG.TRIP_FETCH_FAILED);
    } finally {
      setLoading(false);
      fetchInFlightRef.current = false;
      if (fetchPendingRef.current) {
        fetchPendingRef.current = false;
        fetchTrip();
      }
    }
  }, [tripId, router]);

  // Mutation callback: refetch + broadcast to other clients
  const onMutate = useCallback(async () => {
    await fetchTrip();
    broadcastChange();
  }, [fetchTrip, broadcastChange]);

  useEffect(() => {
    fetchTripRef.current = fetchTrip;
  }, [fetchTrip]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

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
  }, [trip, now, tripId, fetchTrip, onMutate]);

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

  if (loading) {
    return (
      <div>
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
            <div className="flex gap-1 border-b px-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="my-2 h-5 w-14" />
              ))}
            </div>
            <div className="p-4">
              <div className="mb-3 flex items-center gap-1.5">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-full" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <Skeleton className="h-7 w-7 rounded-full" />
                      {i < 3 && <Skeleton className="mt-1 h-10 w-0.5" />}
                    </div>
                    <div className="flex-1 rounded-md border p-3 space-y-2">
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
            <div className="space-y-1.5">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                  <Skeleton className="h-2.5 w-2.5 rounded-full" />
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

  if (error || !trip) {
    return <p className="text-destructive">{error ?? MSG.TRIP_NOT_FOUND}</p>;
  }

  const canEdit = trip.role === "owner" || trip.role === "editor";
  const dayCount = getDayCount(trip.startDate, trip.endDate);

  return (
    <div>
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
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCandidateOpen(true)}
            className="ml-auto lg:hidden"
          >
            <List className="h-4 w-4" />
            候補
            {dnd.localCandidates.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">
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
                className="flex shrink-0 gap-1 overflow-x-auto border-b px-4"
                role="tablist"
                aria-label="日程タブ"
              >
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
              <div
                id={`day-panel-${currentDay.id}`}
                role="tabpanel"
                className="min-h-0 overflow-y-auto p-4"
              >
                <DayTimeline
                  key={currentPattern.id}
                  tripId={tripId}
                  dayId={currentDay.id}
                  patternId={currentPattern.id}
                  date={currentDay.date}
                  schedules={dnd.localSchedules}
                  onRefresh={onMutate}
                  disabled={!online || !canEdit}
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
                  headerContent={
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
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
                                canEdit ? "pl-3 pr-1" : "px-3",
                              )}
                            >
                              {pattern.label}
                            </button>
                            {canEdit && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="py-1.5 pr-2 pl-0.5 text-xs focus:outline-none"
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setRenamePattern(pattern);
                                      setRenameLabel(pattern.label);
                                    }}
                                  >
                                    <Pencil className="mr-2 h-3 w-3" />
                                    名前変更
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDuplicatePattern(pattern.id)}
                                  >
                                    <Copy className="mr-2 h-3 w-3" />
                                    複製
                                  </DropdownMenuItem>
                                  {!pattern.isDefault && (
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => handleDeletePattern(pattern.id)}
                                    >
                                      <Trash2 className="mr-2 h-3 w-3" />
                                      削除
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        );
                      })}
                      {canEdit && online && (
                        <button
                          type="button"
                          onClick={() => setAddPatternOpen(true)}
                          className="shrink-0 rounded-full border border-dashed border-muted-foreground/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
                        >
                          <Plus className="inline h-3 w-3" /> パターン追加
                        </button>
                      )}
                    </div>
                  }
                />
              </div>
            </div>

            {/* Candidates */}
            <div className="hidden max-h-[calc(100vh-8rem)] sm:max-h-[calc(100vh-12rem)] overflow-y-auto lg:block flex-[2] rounded-lg border border-dashed bg-card p-4 self-start sticky top-4">
              <CandidatePanel
                tripId={tripId}
                candidates={dnd.localCandidates}
                currentPatternId={currentPattern.id}
                onRefresh={onMutate}
                disabled={!online || !canEdit}
                draggable={canEdit && online}
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
              />
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
            <Button
              type="submit"
              disabled={addPatternLoading || !addPatternLabel.trim()}
              className="w-full"
            >
              {addPatternLoading ? "追加中..." : "追加"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mobile candidate dialog */}
      <Dialog open={candidateOpen} onOpenChange={setCandidateOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>候補リスト</DialogTitle>
            <p className="text-xs text-muted-foreground">選択して一括操作で予定に追加できます</p>
          </DialogHeader>
          {currentDay && currentPattern && (
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
            />
          )}
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
            <Button
              type="submit"
              disabled={renameLoading || !renameLabel.trim()}
              className="w-full"
            >
              {renameLoading ? "変更中..." : "変更"}
            </Button>
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
    </div>
  );
}
