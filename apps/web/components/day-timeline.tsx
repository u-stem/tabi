"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ScheduleResponse } from "@tabi/shared";
import {
  ArrowUpDown,
  CheckCheck,
  CheckSquare,
  Copy,
  MoreHorizontal,
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
import { api } from "@/lib/api";
import {
  compareByStartTime,
  formatDate,
  getTimeStatus,
  type TimeStatus,
  toDateString,
} from "@/lib/format";
import { useCurrentTime } from "@/lib/hooks/use-current-time";
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

  async function handleDelete(scheduleId: string) {
    try {
      await api(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/${scheduleId}`,
        {
          method: "DELETE",
        },
      );
      toast.success("予定を削除しました");
      onRefresh();
    } catch {
      toast.error("予定の削除に失敗しました");
    }
  }

  async function handleUnassign(scheduleId: string) {
    try {
      await api(`/api/trips/${tripId}/schedules/${scheduleId}/unassign`, {
        method: "POST",
      });
      toast.success("候補に戻しました");
      onRefresh();
    } catch {
      toast.error("候補への移動に失敗しました");
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
      toast.error("並び替えに失敗しました");
    }
  }

  const selectedCount = selectedIds?.size ?? 0;

  return (
    <div>
      {selectionMode ? (
        <div className="mb-3 flex items-center gap-1.5">
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
          <div className="ml-auto flex items-center gap-1.5">
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
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{formatDate(date)}</span>
          <div className="flex items-center gap-1.5">
            {!disabled && (
              <AddScheduleDialog
                tripId={tripId}
                dayId={dayId}
                patternId={patternId}
                onAdd={onRefresh}
                disabled={disabled}
              />
            )}
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

      {selectionMode ? (
        /* Selection mode: plain list without DnD */
        schedules.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">まだ予定がありません</p>
          </div>
        ) : (
          <div>
            {schedules.map((schedule, index) => (
              <ScheduleItem
                key={schedule.id}
                {...schedule}
                tripId={tripId}
                dayId={dayId}
                patternId={patternId}
                isFirst={index === 0}
                isLast={index === schedules.length - 1}
                onDelete={() => handleDelete(schedule.id)}
                onUpdate={onRefresh}
                disabled={disabled}
                timeStatus={getScheduleTimeStatus(schedule)}
                selectable
                selected={selectedIds?.has(schedule.id)}
                onSelect={onToggleSelect}
              />
            ))}
          </div>
        )
      ) : (
        <div ref={setDroppableRef}>
          <SortableContext
            items={schedules.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {schedules.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">まだ予定がありません</p>
                <p className="mt-1 text-xs text-muted-foreground">候補から追加しましょう</p>
              </div>
            ) : (
              <div>
                {schedules.map((schedule, index) => (
                  <ScheduleItem
                    key={schedule.id}
                    {...schedule}
                    tripId={tripId}
                    dayId={dayId}
                    patternId={patternId}
                    isFirst={index === 0}
                    isLast={index === schedules.length - 1}
                    onDelete={() => handleDelete(schedule.id)}
                    onUpdate={onRefresh}
                    onUnassign={disabled ? undefined : () => handleUnassign(schedule.id)}
                    disabled={disabled}
                    timeStatus={getScheduleTimeStatus(schedule)}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
