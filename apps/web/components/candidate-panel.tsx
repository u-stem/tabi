"use client";

import { useDroppable } from "@dnd-kit/core";
import type {
  CandidateResponse,
  DayResponse,
  ScheduleResponse,
  TripResponse,
} from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpDown,
  Bookmark,
  CheckSquare,
  Copy,
  GripVertical,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
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
import { useSelection } from "@/lib/hooks/selection-context";
import { useMobile } from "@/lib/hooks/use-is-mobile";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { moveCandidateToSchedule, removeCandidate } from "@/lib/trip-cache";
import { CandidateList } from "./candidate-list";

const AddCandidateDialog = dynamic(() =>
  import("@/components/add-candidate-dialog").then((mod) => mod.AddCandidateDialog),
);

const EditCandidateDialog = dynamic(() =>
  import("@/components/edit-candidate-dialog").then((mod) => mod.EditCandidateDialog),
);

const DayPickerDrawer = dynamic(() =>
  import("@/components/day-picker-drawer").then((mod) => mod.DayPickerDrawer),
);

type CandidatePanelProps = {
  tripId: string;
  candidates: CandidateResponse[];
  currentDayId: string;
  currentPatternId: string;
  onRefresh: () => void;
  disabled?: boolean;
  draggable?: boolean;
  scheduleLimitReached?: boolean;
  scheduleLimitMessage?: string;
  addDialogOpen?: boolean;
  onAddDialogOpenChange?: (open: boolean) => void;
  overCandidateId?: string | null;
  maxEndDayOffset?: number;
  onSaveToBookmark?: (scheduleIds: string[]) => void;
  onReorderCandidate?: (id: string, direction: "up" | "down") => void;
  days?: DayResponse[];
};

export function CandidatePanel({
  tripId,
  candidates,
  currentDayId,
  currentPatternId,
  onRefresh,
  disabled,
  draggable,
  scheduleLimitReached,
  scheduleLimitMessage,
  addDialogOpen: controlledAddOpen,
  onAddDialogOpenChange: controlledOnAddOpenChange,
  overCandidateId,
  maxEndDayOffset = 0,
  onSaveToBookmark,
  onReorderCandidate,
  days,
}: CandidatePanelProps) {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.trips.detail(tripId);

  const sel = useSelection();
  const selectionMode = sel.selectionTarget === "candidates";
  const selectedIds = selectionMode ? sel.selectedIds : undefined;
  const { setNodeRef: setDroppableRef, isOver: isOverCandidates } = useDroppable({
    id: "candidates",
    data: { type: "candidates" },
  });
  const isMobile = useMobile();
  const [reorderMode, setReorderMode] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [assignPendingSpotId, setAssignPendingSpotId] = useState<string | null>(null);
  const [internalAddOpen, setInternalAddOpen] = useState(false);
  const addOpen = controlledAddOpen ?? internalAddOpen;
  const setAddOpen = controlledOnAddOpenChange ?? setInternalAddOpen;
  const [editSchedule, setEditSchedule] = useState<ScheduleResponse | null>(null);
  const [sortBy, setSortBy] = useState<"order" | "popular">("order");

  const sortedCandidates = useMemo(() => {
    if (sortBy === "popular") {
      return [...candidates].sort((a, b) => {
        const diff = b.likeCount - a.likeCount;
        if (diff !== 0) return diff;
        return a.hmmCount - b.hmmCount;
      });
    }
    return candidates;
  }, [candidates, sortBy]);

  async function handleAssign(spotId: string, dayId?: string, patternId?: string) {
    const targetDayId = dayId ?? currentDayId;
    const targetPatternId = patternId ?? currentPatternId;
    await queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        moveCandidateToSchedule(prev, spotId, targetDayId, targetPatternId),
      );
    }
    toast.success(MSG.CANDIDATE_ASSIGNED);

    try {
      await api(`/api/trips/${tripId}/candidates/${spotId}/assign`, {
        method: "POST",
        body: JSON.stringify({ dayPatternId: targetPatternId }),
      });
      onRefresh();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.CANDIDATE_ASSIGN_FAILED);
    }
  }

  async function handleDelete(spotId: string) {
    await queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(cacheKey, removeCandidate(prev, spotId));
    }
    toast.success(MSG.CANDIDATE_DELETED);

    try {
      await api(`/api/trips/${tripId}/candidates/${spotId}`, {
        method: "DELETE",
      });
      onRefresh();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.CANDIDATE_DELETE_FAILED);
    }
  }

  async function handleReact(scheduleId: string, type: "like" | "hmm") {
    try {
      await api(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "PUT",
        body: JSON.stringify({ type }),
      });
      onRefresh();
    } catch {
      toast.error(MSG.REACTION_FAILED);
    }
  }

  async function handleRemoveReaction(scheduleId: string) {
    try {
      await api(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "DELETE",
      });
      onRefresh();
    } catch {
      toast.error(MSG.REACTION_REMOVE_FAILED);
    }
  }

  function handleAssignSpot(spotId: string) {
    if (isMobile && days) {
      setAssignPendingSpotId(spotId);
      setDayPickerOpen(true);
    } else {
      handleAssign(spotId);
    }
  }

  const selectedCount = selectedIds?.size ?? 0;

  return (
    <div>
      {selectionMode ? (
        <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-muted px-1.5 py-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={sel.exit}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-medium">{selectedCount}件選択中</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={selectedCount === candidates.length ? sel.deselectAll : sel.selectAll}
          >
            {selectedCount === candidates.length ? "全解除" : "全選択"}
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={sel.batchAssign}
              disabled={selectedCount === 0 || sel.batchLoading}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              予定に追加
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
                <DropdownMenuItem onClick={sel.batchDuplicateCandidates}>
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
      ) : reorderMode ? (
        <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-muted px-1.5 py-1">
          <GripVertical className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">並び替え中</span>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setReorderMode(false)}
            >
              完了
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-2 flex items-center gap-1.5">
          <div className="flex flex-1 items-center gap-1.5 [&>*]:flex-1 lg:flex-initial lg:ml-auto lg:[&>*]:flex-initial">
            {!disabled &&
              !isMobile &&
              (scheduleLimitReached ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        <Plus className="h-4 w-4" />
                        候補を追加
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{scheduleLimitMessage}</TooltipContent>
                </Tooltip>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" />
                  候補を追加
                </Button>
              ))}
            {!disabled && candidates.length > 0 && sel.canEnter && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReorderMode(false);
                  sel.enter("candidates");
                }}
              >
                <CheckSquare className="h-4 w-4" />
                選択
              </Button>
            )}
            {!disabled && isMobile && candidates.length > 1 && onReorderCandidate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  sel.exit();
                  setSortBy("order");
                  setReorderMode(true);
                }}
              >
                <GripVertical className="h-4 w-4" />
                並び替え
              </Button>
            )}
            {candidates.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortBy(sortBy === "popular" ? "order" : "popular")}
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortBy === "popular" ? "人気順" : "作成順"}
              </Button>
            )}
          </div>
        </div>
      )}

      <CandidateList
        candidates={sortedCandidates}
        draggable={draggable}
        droppableRef={setDroppableRef}
        isOverCandidates={isOverCandidates}
        overCandidateId={overCandidateId}
        isMobile={isMobile}
        reorderMode={reorderMode}
        disabled={disabled}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggle={sel.toggle}
        onEdit={setEditSchedule}
        onDelete={handleDelete}
        onAssign={handleAssignSpot}
        onReact={handleReact}
        onRemoveReaction={handleRemoveReaction}
        onSaveToBookmark={onSaveToBookmark}
        onReorderCandidate={onReorderCandidate}
      />

      <AddCandidateDialog
        tripId={tripId}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={onRefresh}
        maxEndDayOffset={maxEndDayOffset}
      />

      {editSchedule && (
        <EditCandidateDialog
          tripId={tripId}
          schedule={editSchedule}
          open={editSchedule !== null}
          onOpenChange={(open) => {
            if (!open) setEditSchedule(null);
          }}
          onUpdate={onRefresh}
          maxEndDayOffset={maxEndDayOffset}
        />
      )}

      {isMobile && days && days.length > 0 && (
        <DayPickerDrawer
          open={dayPickerOpen}
          onOpenChange={(open) => {
            setDayPickerOpen(open);
            if (!open) setAssignPendingSpotId(null);
          }}
          days={days.map((d, i) => ({
            id: d.id,
            date: d.date,
            dayIndex: i,
          }))}
          defaultDayIndex={Math.max(
            0,
            days.findIndex((d) => d.id === currentDayId),
          )}
          patternsByDayId={Object.fromEntries(
            days.map((d) => {
              // put the default pattern first so the drawer pre-selects it
              const sorted = [...d.patterns].sort((a, b) => {
                if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
                return a.sortOrder - b.sortOrder;
              });
              return [d.id, sorted.map((p) => ({ id: p.id, label: p.label }))];
            }),
          )}
          onConfirm={(dayId, patternId) => {
            if (assignPendingSpotId) {
              handleAssign(assignPendingSpotId, dayId, patternId ?? currentPatternId);
            }
            setAssignPendingSpotId(null);
          }}
        />
      )}
    </div>
  );
}
