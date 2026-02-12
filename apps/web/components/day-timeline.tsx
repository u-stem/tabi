"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { CrossDayEntry, ScheduleResponse } from "@sugara/shared";
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
import { useCurrentTime } from "@/lib/hooks/use-current-time";
import type { TimelineItem } from "@/lib/merge-timeline";
import { buildMergedTimeline, timelineSortableIds } from "@/lib/merge-timeline";
import { MSG } from "@/lib/messages";
import { AddScheduleDialog } from "./add-schedule-dialog";
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
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onEnterSelectionMode?: () => void;
  onExitSelectionMode?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onBatchUnassign?: () => void;
  onBatchDuplicate?: () => void;
  onBatchDelete?: () => void;
  batchLoading?: boolean;
  maxEndDayOffset?: number;
  totalDays?: number;
  crossDayEntries?: CrossDayEntry[];
  scheduleLimitReached?: boolean;
  scheduleLimitMessage?: string;
  addScheduleOpen?: boolean;
  onAddScheduleOpenChange?: (open: boolean) => void;
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
  selectionMode,
  selectedIds,
  onToggleSelect,
  onEnterSelectionMode,
  onExitSelectionMode,
  onSelectAll,
  onDeselectAll,
  onBatchUnassign,
  onBatchDuplicate,
  onBatchDelete,
  batchLoading,
  maxEndDayOffset,
  totalDays,
  crossDayEntries,
  scheduleLimitReached,
  scheduleLimitMessage,
  addScheduleOpen,
  onAddScheduleOpenChange,
}: DayTimelineProps) {
  const { setNodeRef: setDroppableRef } = useDroppable({
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
    try {
      await api(`/api/trips/${tripId}/days/${dId}/patterns/${pId}/schedules/${scheduleId}`, {
        method: "DELETE",
      });
      toast.success(MSG.SCHEDULE_DELETED);
      onRefresh();
    } catch {
      toast.error(MSG.SCHEDULE_DELETE_FAILED);
    }
  }

  async function handleUnassign(scheduleId: string) {
    try {
      await api(`/api/trips/${tripId}/schedules/${scheduleId}/unassign`, {
        method: "POST",
      });
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

  const selectedCount = selectedIds?.size ?? 0;

  return (
    <div>
      {selectionMode ? (
        <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={onSelectAll}>
              <CheckCheck className="h-4 w-4" />
              全選択
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDeselectAll}
              disabled={selectedCount === 0}
            >
              <X className="h-4 w-4" />
              選択解除
            </Button>
          </div>
          <div className="flex items-center gap-1.5 sm:ml-auto">
            <Button
              size="sm"
              onClick={onBatchUnassign}
              disabled={selectedCount === 0 || batchLoading}
            >
              <Undo2 className="h-4 w-4" />
              候補に戻す
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={selectedCount === 0 || batchLoading}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onBatchDuplicate}>
                  <Copy className="mr-2 h-3 w-3" />
                  複製
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={onBatchDelete}>
                  <Trash2 className="mr-2 h-3 w-3" />
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={onExitSelectionMode}>
              キャンセル
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <span className="text-sm text-muted-foreground">{formatDate(date)}</span>
          <div className="flex items-center gap-1.5 sm:ml-auto">
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
            {!disabled && schedules.length > 0 && onEnterSelectionMode && (
              <Button variant="outline" size="sm" onClick={onEnterSelectionMode}>
                <CheckSquare className="h-4 w-4" />
                選択
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSortByTime}
              disabled={disabled || isSorted}
            >
              <ArrowUpDown className="h-4 w-4" />
              時刻順
            </Button>
          </div>
        </div>
      )}
      {!selectionMode && headerContent}

      {(() => {
        const merged = buildMergedTimeline(schedules, crossDayEntries);
        const total = merged.length;

        if (total === 0) {
          return (
            <div className="rounded-md border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">まだ予定がありません</p>
            </div>
          );
        }

        function renderItem(item: TimelineItem, i: number, opts?: { selectable?: boolean }) {
          const isFirst = i === 0;
          const isLast = i === total - 1;

          if (item.type === "crossDay") {
            // Cross-day entries are not selectable in batch mode because they
            // belong to a different day's pattern and batch operations target
            // the current day's schedules only.
            const { schedule: s, sourceDayId, sourcePatternId, sourceDayNumber } = item.entry;
            // Calculate maxEndDayOffset from the source day, not the display day
            const sourceMaxEndDayOffset =
              totalDays != null ? totalDays - sourceDayNumber : maxEndDayOffset;
            return (
              <ScheduleItem
                key={`cross-${s.id}`}
                {...s}
                tripId={tripId}
                dayId={sourceDayId}
                patternId={sourcePatternId}
                isFirst={isFirst}
                isLast={isLast}
                onDelete={() => handleDelete(s.id, sourceDayId, sourcePatternId)}
                onUpdate={onRefresh}
                onUnassign={!disabled && !opts?.selectable ? () => handleUnassign(s.id) : undefined}
                disabled={disabled}
                timeStatus={isToday ? getCrossDayTimeStatus(now, s.endTime) : null}
                maxEndDayOffset={sourceMaxEndDayOffset}
                crossDayDisplay
                crossDaySourceDayNumber={sourceDayNumber}
              />
            );
          }

          const { schedule } = item;
          return (
            <ScheduleItem
              key={schedule.id}
              {...schedule}
              tripId={tripId}
              dayId={dayId}
              patternId={patternId}
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
              onSelect={opts?.selectable ? onToggleSelect : undefined}
            />
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
              <div>{merged.map((item, i) => renderItem(item, i))}</div>
            </SortableContext>
          </div>
        );
      })()}
    </div>
  );
}
