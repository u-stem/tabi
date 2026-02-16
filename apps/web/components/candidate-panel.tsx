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
} from "@sugara/shared";
import {
  ArrowLeft,
  ArrowUpDown,
  CheckCheck,
  CheckSquare,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Route,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AddCandidateDialog } from "@/components/add-candidate-dialog";
import { EditCandidateDialog } from "@/components/edit-candidate-dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { SELECTED_RING } from "@/lib/colors";
import { formatTimeRange, isSafeUrl } from "@/lib/format";
import { useSelection } from "@/lib/hooks/selection-context";
import { MSG } from "@/lib/messages";
import { buildTransportUrl } from "@/lib/transport-link";
import { cn } from "@/lib/utils";
import { DragHandle } from "./drag-handle";

type CandidatePanelProps = {
  tripId: string;
  candidates: CandidateResponse[];
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
};

function CandidateCard({
  spot,
  onEdit,
  onDelete,
  onAssign,
  onReact,
  onRemoveReaction,
  disabled,
  selectable,
  selected,
  onSelect,
  draggable,
}: {
  spot: CandidateResponse;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
  onReact?: (type: "like" | "hmm") => void;
  onRemoveReaction?: () => void;
  disabled?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  draggable?: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: spot.id,
    disabled: !draggable || disabled || selectable,
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

  return (
    <>
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
          {spot.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
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
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
          {timeStr && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0 text-muted-foreground/70" />
              <span>{timeStr}</span>
            </div>
          )}
          {spot.urls.filter(isSafeUrl).map((u) => (
            <a
              key={u}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{u.replace(/^https?:\/\//, "")}</span>
            </a>
          ))}
          {spot.memo && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground/70">
              <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
              <p className="line-clamp-2">{spot.memo}</p>
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
        {!disabled && !selectable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`${spot.name}のメニュー`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-3 w-3" />
                編集
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAssign}>
                <ArrowLeft className="mr-2 h-3 w-3" />
                予定に追加
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-3 w-3" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
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
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4" />
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function CandidatePanel({
  tripId,
  candidates,
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
}: CandidatePanelProps) {
  const sel = useSelection();
  const selectionMode = sel.selectionTarget === "candidates";
  const selectedIds = selectionMode ? sel.selectedIds : undefined;
  const { setNodeRef: setDroppableRef, isOver: isOverCandidates } = useDroppable({
    id: "candidates",
    data: { type: "candidates" },
  });
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
    try {
      await api(`/api/trips/${tripId}/candidates/${spotId}/assign`, {
        method: "POST",
        body: JSON.stringify({ dayPatternId: currentPatternId }),
      });
      toast.success(MSG.CANDIDATE_ASSIGNED);
      onRefresh();
    } catch {
      toast.error(MSG.CANDIDATE_ASSIGN_FAILED);
    }
  }

  async function handleDelete(spotId: string) {
    try {
      await api(`/api/trips/${tripId}/candidates/${spotId}`, {
        method: "DELETE",
      });
      toast.success(MSG.CANDIDATE_DELETED);
      onRefresh();
    } catch {
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
        <div className="mb-3 flex items-center gap-1.5">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                onClick={sel.batchAssign}
                disabled={selectedCount === 0 || sel.batchLoading}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">予定に追加</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="sm:hidden">予定に追加</TooltipContent>
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
              <DropdownMenuItem onClick={sel.batchDuplicateCandidates}>
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
      ) : (
        <div className="mb-3 flex items-center justify-end gap-1.5">
          <div className="flex items-center gap-1.5">
            {candidates.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={sortBy === "popular" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setSortBy(sortBy === "popular" ? "order" : "popular")}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {sortBy === "popular" ? "人気順" : "作成順"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="sm:hidden">
                  {sortBy === "popular" ? "人気順" : "作成順"}
                </TooltipContent>
              </Tooltip>
            )}
            {!disabled && candidates.length > 0 && sel.canEnter && (
              <Button variant="outline" size="sm" onClick={() => sel.enter("candidates")}>
                <CheckSquare className="h-4 w-4" />
                <span className="hidden sm:inline">選択</span>
              </Button>
            )}
            {!disabled &&
              (scheduleLimitReached ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="outline" size="sm" disabled>
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
                  isOverCandidates && "border-blue-400 bg-blue-50 dark:bg-blue-950/30",
                )}
              >
                <p className="text-xs text-muted-foreground">候補がありません</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {(() => {
                  const insertIndicator = (
                    <div className="flex items-center gap-2 py-1" aria-hidden="true">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <div className="h-0.5 flex-1 bg-blue-500" />
                    </div>
                  );
                  return (
                    <>
                      {sortedCandidates.map((spot) => (
                        <div key={spot.id}>
                          {overCandidateId === spot.id && insertIndicator}
                          <CandidateCard
                            spot={spot}
                            onEdit={() => setEditSchedule(spot)}
                            onDelete={() => handleDelete(spot.id)}
                            onAssign={() => handleAssign(spot.id)}
                            onReact={(type) => handleReact(spot.id, type)}
                            onRemoveReaction={() => handleRemoveReaction(spot.id)}
                            disabled={disabled}
                            draggable={!selectionMode}
                            selectable={selectionMode}
                            selected={selectedIds?.has(spot.id)}
                            onSelect={sel.toggle}
                          />
                        </div>
                      ))}
                      {isOverCandidates && overCandidateId === null && insertIndicator}
                    </>
                  );
                })()}
              </div>
            )}
          </SortableContext>
        </div>
      ) : sortedCandidates.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed text-center">
          <p className="text-xs text-muted-foreground">候補がありません</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortedCandidates.map((spot) => (
            <CandidateCard
              key={spot.id}
              spot={spot}
              onEdit={() => setEditSchedule(spot)}
              onDelete={() => handleDelete(spot.id)}
              onAssign={() => handleAssign(spot.id)}
              onReact={(type) => handleReact(spot.id, type)}
              onRemoveReaction={() => handleRemoveReaction(spot.id)}
              disabled={disabled}
              selectable={selectionMode}
              selected={selectedIds?.has(spot.id)}
              onSelect={sel.toggle}
            />
          ))}
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
