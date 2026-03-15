"use client";

import { defaultAnimateLayoutChanges, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CATEGORY_LABELS,
  type CandidateResponse,
  type ScheduleCategory,
  TRANSPORT_METHOD_LABELS,
  type TransportMethod,
} from "@sugara/shared";
import {
  ArrowLeft,
  Bookmark,
  Clock,
  ExternalLink,
  MapPin,
  Pencil,
  Route,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import { memo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogDestructiveAction,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { SELECTED_RING } from "@/lib/colors";
import { formatTimeRange, isSafeUrl, stripProtocol } from "@/lib/format";
import { useMobile } from "@/lib/hooks/use-is-mobile";
import { buildMapsSearchUrl, buildTransportUrl } from "@/lib/transport-link";
import { cn } from "@/lib/utils";
import { ActionSheet } from "./action-sheet";
import { DragHandle } from "./drag-handle";
import { ItemMenuButton } from "./item-menu-button";
import { ReorderControls } from "./reorder-controls";

type CandidateItemProps = {
  spot: CandidateResponse;
  onEdit: () => void;
  onDelete: () => void;
  onAssign?: () => void;
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
};

export const CandidateItem = memo(function CandidateItem({
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
}: CandidateItemProps) {
  const isMobile = useMobile();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: spot.id,
    animateLayoutChanges: defaultAnimateLayoutChanges,
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
  const CardWrapper = selectable ? "button" : "div";
  const cardElement = (
    <CardWrapper
      ref={setNodeRef}
      style={style}
      type={selectable ? "button" : undefined}
      className={cn(
        "animate-in fade-in-0 slide-in-from-top-1 duration-200",
        "flex items-center gap-2 rounded-md border p-3",
        isDragging && "opacity-50",
        selectable &&
          "w-full cursor-pointer text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selectable && selected && SELECTED_RING,
      )}
      {...(selectable
        ? {
            onClick: () => onSelect?.(spot.id),
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
      {/* `disabled` is intentionally not checked here: viewers (canEdit=false) should be
          able to react, and offline failures degrade gracefully via toast. */}
      {!selectable && onReact && (
        <div className="flex select-none items-center gap-0.5">
          <button
            type="button"
            onClick={() => (spot.myReaction === "like" ? onRemoveReaction?.() : onReact("like"))}
            className={cn(
              "inline-flex min-h-[36px] items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
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
              "inline-flex min-h-[36px] items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
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
                ...(onAssign
                  ? [
                      {
                        label: "予定に追加",
                        icon: <ArrowLeft className="h-4 w-4" />,
                        onClick: onAssign,
                      },
                    ]
                  : []),
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
              {onAssign && (
                <DropdownMenuItem onClick={onAssign}>
                  <ArrowLeft />
                  予定に追加
                </DropdownMenuItem>
              )}
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
    </CardWrapper>
  );

  return (
    <>
      {cardElement}
      <ResponsiveAlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>候補を削除しますか？</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              「{spot.name}」を削除します。この操作は取り消せません。
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>
              <X className="h-4 w-4" />
              キャンセル
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogDestructiveAction onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              削除する
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </>
  );
});
