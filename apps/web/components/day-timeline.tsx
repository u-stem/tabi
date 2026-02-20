"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { CrossDayEntry, ScheduleResponse, TripResponse } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Bookmark,
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
import { DROP_ZONE_ACTIVE } from "@/lib/colors";
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
import { moveScheduleToCandidate, removeScheduleFromPattern } from "@/lib/trip-cache";
import { cn } from "@/lib/utils";
import { DndInsertIndicator } from "./dnd-insert-indicator";

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
  onSaveToBookmark?: (scheduleIds: string[]) => void;
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
  onSaveToBookmark,
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
    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(cacheKey, removeScheduleFromPattern(prev, dId, pId, scheduleId));
    }

    toast.success(MSG.SCHEDULE_DELETED);

    try {
      await api(`/api/trips/${tripId}/days/${dId}/patterns/${pId}/schedules/${scheduleId}`, {
        method: "DELETE",
      });
      onRefresh();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.SCHEDULE_DELETE_FAILED);
    }
  }

  async function handleUnassign(scheduleId: string) {
    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        moveScheduleToCandidate(prev, dayId, patternId, scheduleId),
      );
    }
    toast.success(MSG.SCHEDULE_MOVED_TO_CANDIDATE);

    try {
      await api(`/api/trips/${tripId}/schedules/${scheduleId}/unassign`, {
        method: "POST",
      });
      onRefresh();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
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
        <div className="mb-2 flex select-none items-center gap-1.5 rounded-lg bg-muted px-1.5 py-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={sel.exit}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-medium">{selectedCount}件選択中</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={selectedCount === schedules.length ? sel.deselectAll : sel.selectAll}
          >
            {selectedCount === schedules.length ? "全解除" : "全選択"}
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={sel.batchUnassign}
              disabled={selectedCount === 0 || sel.batchLoading}
            >
              <Undo2 className="h-3.5 w-3.5" />
              候補に戻す
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={selectedCount === 0 || sel.batchLoading}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={sel.batchDuplicateSchedules}>
                  <Copy />
                  複製
                </DropdownMenuItem>
                {onSaveToBookmark && (
                  <DropdownMenuItem onClick={() => onSaveToBookmark(Array.from(selectedIds ?? []))}>
                    <Bookmark />
                    ブックマークに保存
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => sel.setBatchDeleteOpen(true)}
                >
                  <Trash2 />
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : (
        <div className="mb-2 flex select-none items-center gap-1.5">
          <span className="hidden text-sm text-muted-foreground lg:inline">{formatDate(date)}</span>
          <div className="flex flex-1 items-center gap-1.5 [&>*]:flex-1 lg:ml-auto lg:flex-initial lg:[&>*]:flex-initial">
            {!disabled &&
              (scheduleLimitReached ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="outline" size="sm" className="w-full" disabled>
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
                選択
              </Button>
            )}
            {schedules.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSortByTime}
                disabled={disabled || isSorted}
              >
                <ArrowUpDown className="h-4 w-4" />
                時刻順
              </Button>
            )}
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
                isOverTimeline && DROP_ZONE_ACTIVE,
              )}
            >
              <p className="text-sm text-muted-foreground">まだ予定がありません</p>
            </div>
          );
        }

        const insertIndicator = <DndInsertIndicator />;

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
          const scheduleEl = (
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
              onSaveToBookmark={
                onSaveToBookmark ? () => onSaveToBookmark([schedule.id]) : undefined
              }
            />
          );

          return (
            <div key={schedule.id}>
              {showInsertIndicator && insertIndicator}
              {scheduleEl}
            </div>
          );
        }

        return selectionMode ? (
          <div className="space-y-1.5">
            {merged.map((item, i) => renderItem(item, i, { selectable: true }))}
          </div>
        ) : (
          <div ref={setDroppableRef}>
            <SortableContext
              items={timelineSortableIds(merged)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
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
