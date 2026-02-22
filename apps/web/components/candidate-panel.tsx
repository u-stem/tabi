"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CATEGORY_LABELS,
  type CandidateResponse,
  type ScheduleCategory,
  type ScheduleResponse,
  TRANSPORT_METHOD_LABELS,
  type TransportMethod,
  type TripResponse,
} from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpDown,
  Bookmark,
  CheckSquare,
  Clock,
  Copy,
  ExternalLink,
  GripVertical,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Route,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const AddCandidateDialog = dynamic(() =>
  import("@/components/add-candidate-dialog").then((mod) => mod.AddCandidateDialog),
);

const EditCandidateDialog = dynamic(() =>
  import("@/components/edit-candidate-dialog").then((mod) => mod.EditCandidateDialog),
);

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogDestructiveAction,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { DROP_ZONE_ACTIVE, SELECTED_RING } from "@/lib/colors";
import { formatTimeRange, isSafeUrl, stripProtocol } from "@/lib/format";
import { useSelection } from "@/lib/hooks/selection-context";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { buildMapsSearchUrl, buildTransportUrl } from "@/lib/transport-link";
import { moveCandidateToSchedule, removeCandidate } from "@/lib/trip-cache";
import { cn } from "@/lib/utils";
import { ActionSheet } from "./action-sheet";
import { DndInsertIndicator } from "./dnd-insert-indicator";
import { DragHandle } from "./drag-handle";
import { ItemMenuButton } from "./item-menu-button";
import { ReorderControls } from "./reorder-controls";

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
};

function CandidateCard({
  spot,
  onEdit,
  onDelete,
  onAssign,
  onReact,
  onRemoveReaction,
  onSaveToBookmark,
  disabled,
  selectable,
  selected,
  onSelect,
  draggable,
  reorderable,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  spot: CandidateResponse;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
  onReact?: (type: "like" | "hmm") => void;
  onRemoveReaction?: () => void;
  onSaveToBookmark?: () => void;
  disabled?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  draggable?: boolean;
  reorderable?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const isMobile = useIsMobile();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: spot.id,
    disabled: !draggable || disabled || selectable || reorderable,
    data: { type: "candidate" },
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const timeStr = formatTimeRange(spot.startTime, spot.endTime);
  const transportLabel = spot.transportMethod
    ? TRANSPORT_METHOD_LABELS[spot.transportMethod as TransportMethod]
    : null;
  const cardElement = (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border p-3",
        isDragging && "opacity-50",
        selectable &&
          "cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selectable && selected && SELECTED_RING,
      )}
      {...(selectable
        ? {
            onClick: () => onSelect?.(spot.id),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(spot.id);
              }
            },
            role: "button" as const,
            tabIndex: 0,
            "aria-pressed": selected,
          }
        : {})}
    >
      {selectable ? (
        <SelectionIndicator checked={!!selected} />
      ) : reorderable ? (
        <ReorderControls
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          isFirst={!!isFirst}
          isLast={!!isLast}
        />
      ) : draggable ? (
        <DragHandle attributes={attributes} listeners={listeners} />
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-baseline gap-1.5 text-sm">
          <span className="truncate font-medium">{spot.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {CATEGORY_LABELS[spot.category as ScheduleCategory]}
          </span>
        </p>
        {timeStr && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0 text-muted-foreground/70" />
            <span>{timeStr}</span>
          </div>
        )}
        {spot.address && (
          <a
            href={buildMapsSearchUrl(spot.address)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex w-fit max-w-full items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400",
              selectable && "pointer-events-none",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{spot.address}</span>
          </a>
        )}
        {spot.category === "transport" &&
          (spot.departurePlace || spot.arrivalPlace) &&
          (() => {
            const routeStr =
              spot.departurePlace && spot.arrivalPlace
                ? `${spot.departurePlace} → ${spot.arrivalPlace}`
                : spot.departurePlace || spot.arrivalPlace;
            const transitUrl =
              spot.departurePlace && spot.arrivalPlace
                ? buildTransportUrl({
                    from: spot.departurePlace,
                    to: spot.arrivalPlace,
                    method: spot.transportMethod,
                    time: spot.startTime,
                  })
                : null;
            return (
              <span
                className={cn(
                  "flex w-fit max-w-full items-center gap-1.5 text-xs text-muted-foreground",
                  selectable && "pointer-events-none",
                )}
              >
                <Route className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                {transitUrl ? (
                  <a
                    href={transitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-blue-600 hover:underline dark:text-blue-400"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {routeStr}
                  </a>
                ) : (
                  <span className="truncate">{routeStr}</span>
                )}
                {transportLabel && <span className="shrink-0">({transportLabel})</span>}
              </span>
            );
          })()}
        {spot.urls.filter(isSafeUrl).map((u) => (
          <a
            key={u}
            href={u}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex w-fit max-w-full items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400",
              selectable && "pointer-events-none",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{stripProtocol(u)}</span>
          </a>
        ))}
        {spot.memo && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground/70">
            <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
            <p className="whitespace-pre-line">{spot.memo}</p>
          </div>
        )}
      </div>
      {!disabled && !selectable && onReact && (
        <div className="flex select-none items-center gap-0.5">
          <button
            type="button"
            onClick={() => (spot.myReaction === "like" ? onRemoveReaction?.() : onReact("like"))}
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs transition-colors",
              spot.myReaction === "like" ? "bg-accent font-medium" : "hover:bg-muted",
            )}
            aria-label="いいね"
            aria-pressed={spot.myReaction === "like"}
          >
            <span className="text-base" aria-hidden="true">
              {"👍"}
            </span>
            {spot.likeCount > 0 && <span>{spot.likeCount}</span>}
          </button>
          <button
            type="button"
            onClick={() => (spot.myReaction === "hmm" ? onRemoveReaction?.() : onReact("hmm"))}
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs transition-colors",
              spot.myReaction === "hmm" ? "bg-accent font-medium" : "hover:bg-muted",
            )}
            aria-label="うーん"
            aria-pressed={spot.myReaction === "hmm"}
          >
            <span className="text-base" aria-hidden="true">
              {"🤔"}
            </span>
            {spot.hmmCount > 0 && <span>{spot.hmmCount}</span>}
          </button>
        </div>
      )}
      {!disabled &&
        !selectable &&
        (isMobile ? (
          <>
            <ItemMenuButton
              ariaLabel={`${spot.name}のメニュー`}
              onClick={() => setSheetOpen(true)}
            />
            <ActionSheet
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              actions={[
                {
                  label: "編集",
                  icon: <Pencil className="h-4 w-4" />,
                  onClick: onEdit,
                },
                {
                  label: "予定に追加",
                  icon: <ArrowLeft className="h-4 w-4" />,
                  onClick: onAssign,
                },
                ...(onSaveToBookmark
                  ? [
                      {
                        label: "ブックマークに保存",
                        icon: <Bookmark className="h-4 w-4" />,
                        onClick: onSaveToBookmark,
                      },
                    ]
                  : []),
                {
                  label: "削除",
                  icon: <Trash2 className="h-4 w-4" />,
                  onClick: () => setDeleteOpen(true),
                  variant: "destructive" as const,
                },
              ]}
            />
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ItemMenuButton ariaLabel={`${spot.name}のメニュー`} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil />
                編集
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAssign}>
                <ArrowLeft />
                予定に追加
              </DropdownMenuItem>
              {onSaveToBookmark && (
                <DropdownMenuItem onClick={onSaveToBookmark}>
                  <Bookmark />
                  ブックマークに保存
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
    </div>
  );

  return (
    <>
      {cardElement}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>候補を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{spot.name}」を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogDestructiveAction onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              削除する
            </AlertDialogDestructiveAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

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
  const isMobile = useIsMobile();
  const [reorderMode, setReorderMode] = useState(false);
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

  async function handleAssign(spotId: string) {
    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        moveCandidateToSchedule(prev, spotId, currentDayId, currentPatternId),
      );
    }
    toast.success(MSG.CANDIDATE_ASSIGNED);

    try {
      await api(`/api/trips/${tripId}/candidates/${spotId}/assign`, {
        method: "POST",
        body: JSON.stringify({ dayPatternId: currentPatternId }),
      });
      onRefresh();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.CANDIDATE_ASSIGN_FAILED);
    }
  }

  async function handleDelete(spotId: string) {
    queryClient.cancelQueries({ queryKey: cacheKey });
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
          <div className="flex flex-1 items-center gap-1.5 [&>*]:flex-1 lg:flex-initial lg:[&>*]:flex-initial lg:ml-auto">
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
                variant={sortBy === "popular" ? "secondary" : "outline"}
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
      {draggable ? (
        <div ref={setDroppableRef}>
          <SortableContext
            items={sortedCandidates.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedCandidates.length === 0 ? (
              <div
                className={cn(
                  "flex min-h-24 items-center justify-center rounded-md border border-dashed text-center transition-colors",
                  isOverCandidates && DROP_ZONE_ACTIVE,
                )}
              >
                <p className="text-sm text-muted-foreground">候補がありません</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {(() => {
                  const overlayIndicator = <DndInsertIndicator overlay />;
                  const inlineIndicator = <DndInsertIndicator />;
                  return (
                    <>
                      {sortedCandidates.map((spot, idx) => {
                        const isReorderable = isMobile && reorderMode && !disabled;
                        return (
                          <div key={spot.id} className="relative">
                            {overCandidateId === spot.id && overlayIndicator}
                            <CandidateCard
                              spot={spot}
                              onEdit={() => setEditSchedule(spot)}
                              onDelete={() => handleDelete(spot.id)}
                              onAssign={() => handleAssign(spot.id)}
                              onReact={(type) => handleReact(spot.id, type)}
                              onRemoveReaction={() => handleRemoveReaction(spot.id)}
                              onSaveToBookmark={
                                onSaveToBookmark ? () => onSaveToBookmark([spot.id]) : undefined
                              }
                              disabled={disabled}
                              draggable={!isMobile && !selectionMode}
                              selectable={selectionMode}
                              selected={selectedIds?.has(spot.id)}
                              onSelect={sel.toggle}
                              reorderable={isReorderable}
                              onMoveUp={
                                isReorderable
                                  ? () => onReorderCandidate?.(spot.id, "up")
                                  : undefined
                              }
                              onMoveDown={
                                isReorderable
                                  ? () => onReorderCandidate?.(spot.id, "down")
                                  : undefined
                              }
                              isFirst={idx === 0}
                              isLast={idx === sortedCandidates.length - 1}
                            />
                          </div>
                        );
                      })}
                      {isOverCandidates && overCandidateId === null && inlineIndicator}
                    </>
                  );
                })()}
              </div>
            )}
          </SortableContext>
        </div>
      ) : sortedCandidates.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed text-center">
          <p className="text-sm text-muted-foreground">候補がありません</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortedCandidates.map((spot, idx) => {
            const isReorderable = isMobile && reorderMode && !disabled;
            return (
              <CandidateCard
                key={spot.id}
                spot={spot}
                onEdit={() => setEditSchedule(spot)}
                onDelete={() => handleDelete(spot.id)}
                onAssign={() => handleAssign(spot.id)}
                onReact={(type) => handleReact(spot.id, type)}
                onRemoveReaction={() => handleRemoveReaction(spot.id)}
                onSaveToBookmark={onSaveToBookmark ? () => onSaveToBookmark([spot.id]) : undefined}
                disabled={disabled}
                selectable={selectionMode}
                selected={selectedIds?.has(spot.id)}
                onSelect={sel.toggle}
                reorderable={isReorderable}
                onMoveUp={isReorderable ? () => onReorderCandidate?.(spot.id, "up") : undefined}
                onMoveDown={isReorderable ? () => onReorderCandidate?.(spot.id, "down") : undefined}
                isFirst={idx === 0}
                isLast={idx === sortedCandidates.length - 1}
              />
            );
          })}
        </div>
      )}

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
    </div>
  );
}
