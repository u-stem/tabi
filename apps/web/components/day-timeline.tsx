"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { CrossDayEntry, ScheduleResponse, TripResponse } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  CheckCheck,
  CheckSquare,
  Copy,
  MoreHorizontal,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import {
  compareByStartTime,
  formatDate,
  getCrossDayTimeStatus,
  getTimeStatus,
  type TimeStatus,
  toDateString,
} from "@/lib/format";
import { useSelection } from "@/lib/hooks/selection-context";
import { useCurrentTime } from "@/lib/hooks/use-current-time";
import type { TimelineItem } from "@/lib/merge-timeline";
import { buildMergedTimeline, timelineSortableIds } from "@/lib/merge-timeline";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import {
  moveScheduleToCandidate,
  removeScheduleFromPattern,
  toScheduleResponse,
} from "@/lib/trip-cache";
import { cn } from "@/lib/utils";

const AddScheduleDialog = dynamic(() =>
  import("./add-schedule-dialog").then((mod) => mod.AddScheduleDialog),
);

import { ScheduleItem } from "./schedule-item";

type DayTimelineProps = {
  tripId: string;
  dayId: string;
  patternId: string;
  date: string;
  schedules: ScheduleResponse[];
  onRefresh: () => void;
  disabled?: boolean;
  headerContent?: React.ReactNode;
  maxEndDayOffset?: number;
  totalDays?: number;
  crossDayEntries?: CrossDayEntry[];
  scheduleLimitReached?: boolean;
  scheduleLimitMessage?: string;
  addScheduleOpen?: boolean;
  onAddScheduleOpenChange?: (open: boolean) => void;
  overScheduleId?: string | null;
};

export function DayTimeline({
  tripId,
  dayId,
  patternId,
  date,
  schedules,
  onRefresh,
  disabled,
  headerContent,
  maxEndDayOffset,
  totalDays,
  crossDayEntries,
  scheduleLimitReached,
  scheduleLimitMessage,
  addScheduleOpen,
  onAddScheduleOpenChange,
  overScheduleId,
}: DayTimelineProps) {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.trips.detail(tripId);

  const sel = useSelection();
  const selectionMode = sel.selectionTarget === "timeline";
  const selectedIds = selectionMode ? sel.selectedIds : undefined;
  const selectedCount = selectedIds?.size ?? 0;
  const { setNodeRef: setDroppableRef, isOver: isOverTimeline } = useDroppable({
    id: "timeline",
    data: { type: "timeline" },
  });

  const now = useCurrentTime();
  const isToday = date === toDateString(new Date());

  function getScheduleTimeStatus(schedule: ScheduleResponse): TimeStatus | null {
    if (!isToday) return null;
    return getTimeStatus(now, schedule.startTime, schedule.endTime);
  }

  async function handleDelete(
    scheduleId: string,
    overrideDayId?: string,
    overridePatternId?: string,
  ) {
    const dId = overrideDayId ?? dayId;
    const pId = overridePatternId ?? patternId;

    // Cancel in-flight refetches to prevent them from overwriting the optimistic update
    await queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(cacheKey, removeScheduleFromPattern(prev, dId, pId, scheduleId));
    }

    try {
      await api(`/api/trips/${tripId}/days/${dId}/patterns/${pId}/schedules/${scheduleId}`, {
        method: "DELETE",
      });
      toast.success(MSG.SCHEDULE_DELETED);
      onRefresh();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.SCHEDULE_DELETE_FAILED);
    }
  }

  async function handleUnassign(scheduleId: string) {
    try {
      const result = await api<Record<string, unknown>>(
        `/api/trips/${tripId}/schedules/${scheduleId}/unassign`,
        { method: "POST" },
      );
      const prev = queryClient.getQueryData<TripResponse>(cacheKey);
      if (prev) {
        queryClient.setQueryData(
          cacheKey,
          moveScheduleToCandidate(prev, dayId, patternId, scheduleId, toScheduleResponse(result)),
        );
      }
      toast.success(MSG.SCHEDULE_MOVED_TO_CANDIDATE);
      onRefresh();
    } catch {
      toast.error(MSG.SCHEDULE_MOVE_FAILED);
    }
  }

  const isSorted =
    schedules.length <= 1 ||
    schedules.every(
      (schedule, i) => i === 0 || compareByStartTime(schedules[i - 1], schedule) <= 0,
    );

  async function handleSortByTime() {
    const sorted = [...schedules].sort(compareByStartTime);
    const scheduleIds = sorted.map((s) => s.id);
    try {
      await api(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ scheduleIds }),
      });
      onRefresh();
    } catch {
      toast.error(MSG.SCHEDULE_REORDER_FAILED);
    }
  }

  return (
    <div>
      {selectionMode ? (
        <div className="mb-3 flex flex-wrap select-none items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={sel.selectAll}>
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">全選択</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={sel.deselectAll}
              disabled={selectedCount === 0}
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">選択解除</span>
            </Button>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={sel.batchUnassign}
                  disabled={selectedCount === 0 || sel.batchLoading}
                >
                  <Undo2 className="h-4 w-4" />
                  <span className="hidden sm:inline">候補に戻す</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="sm:hidden">候補に戻す</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedCount === 0 || sel.batchLoading}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={sel.batchDuplicateSchedules}>
                  <Copy className="mr-2 h-3 w-3" />
                  複製
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => sel.setBatchDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={sel.exit}>
              キャンセル
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap select-none items-center gap-1.5">
          <span className="text-sm text-muted-foreground">{formatDate(date)}</span>
          <div className="flex items-center gap-1.5 ml-auto">
            {!disabled &&
              (scheduleLimitReached ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="outline" size="sm" disabled>
                        <Plus className="h-4 w-4" />
                        予定を追加
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{scheduleLimitMessage}</TooltipContent>
                </Tooltip>
              ) : (
                <AddScheduleDialog
                  tripId={tripId}
                  dayId={dayId}
                  patternId={patternId}
                  onAdd={onRefresh}
                  disabled={disabled}
                  maxEndDayOffset={maxEndDayOffset}
                  open={addScheduleOpen}
                  onOpenChange={onAddScheduleOpenChange}
                />
              ))}
            {!disabled && schedules.length > 0 && sel.canEnter && (
              <Button variant="outline" size="sm" onClick={() => sel.enter("timeline")}>
                <CheckSquare className="h-4 w-4" />
                <span className="hidden sm:inline">選択</span>
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSortByTime}
                  disabled={disabled || isSorted}
                >
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="hidden sm:inline">時刻順</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="sm:hidden">時刻順に並べ替え</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
      {!selectionMode && headerContent}

      {(() => {
        const merged = buildMergedTimeline(schedules, crossDayEntries);
        const total = merged.length;

        if (total === 0) {
          return (
            <div
              ref={selectionMode ? undefined : setDroppableRef}
              className={cn(
                "rounded-md border border-dashed p-6 text-center transition-colors",
                isOverTimeline && "border-blue-400 bg-blue-50 dark:bg-blue-950/30",
              )}
            >
              <p className="text-sm text-muted-foreground">まだ予定がありません</p>
            </div>
          );
        }

        const insertIndicator = (
          <div className="flex items-center gap-2 py-1" aria-hidden="true">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <div className="h-0.5 flex-1 bg-blue-500" />
          </div>
        );

        function renderItem(item: TimelineItem, i: number, opts?: { selectable?: boolean }) {
          const isFirst = i === 0;
          const isLast = i === total - 1;

          // Determine sortable ID to match against overScheduleId
          const sortableId =
            item.type === "crossDay" ? `cross-${item.entry.schedule.id}` : item.schedule.id;
          const showInsertIndicator = overScheduleId != null && sortableId === overScheduleId;

          if (item.type === "crossDay") {
            // Cross-day entries are not selectable in batch mode because they
            // belong to a different day's pattern and batch operations target
            // the current day's schedules only.
            const {
              schedule: s,
              sourceDayId,
              sourcePatternId,
              sourceDayNumber,
              crossDayPosition,
            } = item.entry;
            // Calculate maxEndDayOffset from the source day, not the display day
            const sourceMaxEndDayOffset =
              totalDays != null ? totalDays - sourceDayNumber : maxEndDayOffset;
            return (
              <div key={`cross-${s.id}`}>
                {showInsertIndicator && insertIndicator}
                <ScheduleItem
                  {...s}
                  tripId={tripId}
                  dayId={sourceDayId}
                  patternId={sourcePatternId}
                  date={date}
                  isFirst={isFirst}
                  isLast={isLast}
                  onDelete={() => handleDelete(s.id, sourceDayId, sourcePatternId)}
                  onUpdate={onRefresh}
                  onUnassign={
                    !disabled && !opts?.selectable ? () => handleUnassign(s.id) : undefined
                  }
                  disabled={disabled}
                  timeStatus={isToday ? getCrossDayTimeStatus(now, s.endTime) : null}
                  maxEndDayOffset={sourceMaxEndDayOffset}
                  crossDayDisplay
                  crossDaySourceDayNumber={sourceDayNumber}
                  crossDayPosition={crossDayPosition}
                />
              </div>
            );
          }

          const { schedule } = item;
          const schedulesAfter = schedules.filter((s) => s.sortOrder > schedule.sortOrder);
          return (
            <div key={schedule.id}>
              {showInsertIndicator && insertIndicator}
              <ScheduleItem
                {...schedule}
                tripId={tripId}
                dayId={dayId}
                patternId={patternId}
                date={date}
                isFirst={isFirst}
                isLast={isLast}
                onDelete={() => handleDelete(schedule.id)}
                onUpdate={onRefresh}
                onUnassign={
                  !disabled && !opts?.selectable ? () => handleUnassign(schedule.id) : undefined
                }
                disabled={disabled}
                timeStatus={getScheduleTimeStatus(schedule)}
                maxEndDayOffset={maxEndDayOffset}
                selectable={opts?.selectable}
                selected={opts?.selectable ? selectedIds?.has(schedule.id) : undefined}
                onSelect={opts?.selectable ? sel.toggle : undefined}
                siblingSchedules={schedulesAfter}
              />
            </div>
          );
        }

        return selectionMode ? (
          <div>{merged.map((item, i) => renderItem(item, i, { selectable: true }))}</div>
        ) : (
          <div ref={setDroppableRef}>
            <SortableContext
              items={timelineSortableIds(merged)}
              strategy={verticalListSortingStrategy}
            >
              <div>
                {merged.map((item, i) => renderItem(item, i))}
                {isOverTimeline && overScheduleId === null && insertIndicator}
              </div>
            </SortableContext>
          </div>
        );
      })()}
    </div>
  );
}
