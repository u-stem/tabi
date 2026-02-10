"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { SpotResponse } from "@tabi/shared";
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
import { compareByStartTime, formatDate, getTimeStatus, type TimeStatus } from "@/lib/format";
import { useCurrentTime } from "@/lib/hooks/use-current-time";
import { AddSpotDialog } from "./add-spot-dialog";
import { SpotItem } from "./spot-item";

type DayTimelineProps = {
  tripId: string;
  dayId: string;
  patternId: string;
  date: string;
  spots: SpotResponse[];
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
  spots,
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
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isToday = date === todayStr;

  function getSpotTimeStatus(spot: SpotResponse): TimeStatus | null {
    if (!isToday) return null;
    return getTimeStatus(now, spot.startTime, spot.endTime);
  }

  async function handleDelete(spotId: string) {
    try {
      await api(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots/${spotId}`, {
        method: "DELETE",
      });
      toast.success("予定を削除しました");
      onRefresh();
    } catch {
      toast.error("予定の削除に失敗しました");
    }
  }

  async function handleUnassign(spotId: string) {
    try {
      await api(`/api/trips/${tripId}/spots/${spotId}/unassign`, {
        method: "POST",
      });
      toast.success("候補に戻しました");
      onRefresh();
    } catch {
      toast.error("候補への移動に失敗しました");
    }
  }

  const isSorted =
    spots.length <= 1 ||
    spots.every((spot, i) => i === 0 || compareByStartTime(spots[i - 1], spot) <= 0);

  async function handleSortByTime() {
    const sorted = [...spots].sort(compareByStartTime);
    const spotIds = sorted.map((s) => s.id);
    try {
      await api(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ spotIds }),
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
              <AddSpotDialog
                tripId={tripId}
                dayId={dayId}
                patternId={patternId}
                onAdd={onRefresh}
                disabled={disabled}
              />
            )}
            {!disabled && spots.length > 0 && onEnterSelectionMode && (
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
        spots.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">まだ予定がありません</p>
          </div>
        ) : (
          <div>
            {spots.map((spot, index) => (
              <SpotItem
                key={spot.id}
                {...spot}
                tripId={tripId}
                dayId={dayId}
                patternId={patternId}
                isFirst={index === 0}
                isLast={index === spots.length - 1}
                onDelete={() => handleDelete(spot.id)}
                onUpdate={onRefresh}
                disabled={disabled}
                timeStatus={getSpotTimeStatus(spot)}
                selectable
                selected={selectedIds?.has(spot.id)}
                onSelect={onToggleSelect}
              />
            ))}
          </div>
        )
      ) : (
        <div ref={setDroppableRef}>
          <SortableContext items={spots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {spots.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">まだ予定がありません</p>
                <p className="mt-1 text-xs text-muted-foreground">候補から追加しましょう</p>
              </div>
            ) : (
              <div>
                {spots.map((spot, index) => (
                  <SpotItem
                    key={spot.id}
                    {...spot}
                    tripId={tripId}
                    dayId={dayId}
                    patternId={patternId}
                    isFirst={index === 0}
                    isLast={index === spots.length - 1}
                    onDelete={() => handleDelete(spot.id)}
                    onUpdate={onRefresh}
                    onUnassign={disabled ? undefined : () => handleUnassign(spot.id)}
                    disabled={disabled}
                    timeStatus={getSpotTimeStatus(spot)}
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
