"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ScheduleCategory, ScheduleColor, TransportMethod } from "@sugara/shared";
import { TRANSPORT_METHOD_LABELS } from "@sugara/shared";
import { MoreHorizontal, Pencil, Trash2, Undo2 } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { SCHEDULE_COLOR_CLASSES, SELECTED_RING } from "@/lib/colors";
import type { TimeStatus } from "@/lib/format";
import { formatTime, formatTimeRange } from "@/lib/format";
import { CATEGORY_ICONS, TRANSPORT_ICONS } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { EditScheduleDialog } from "./edit-schedule-dialog";

type ScheduleItemProps = {
  id: string;
  name: string;
  category: ScheduleCategory;
  address?: string | null;
  url?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
  departurePlace?: string | null;
  arrivalPlace?: string | null;
  transportMethod?: string | null;
  color?: ScheduleColor;
  updatedAt: string;
  tripId: string;
  dayId: string;
  patternId: string;
  onDelete: () => void;
  onUpdate: () => void;
  onUnassign?: () => void;
  disabled?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  timeStatus?: TimeStatus | null;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

type UseSortableReturn = ReturnType<typeof useSortable>;

type SortableProps = {
  nodeRef: UseSortableReturn["setNodeRef"];
  style: CSSProperties;
  attributes: UseSortableReturn["attributes"];
  listeners: UseSortableReturn["listeners"];
  isDragging: boolean;
};

export function ScheduleItem(props: ScheduleItemProps) {
  const { id, category, disabled, selectable } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: disabled || selectable,
    data: { type: "schedule" },
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const sortable: SortableProps = {
    nodeRef: setNodeRef,
    style,
    attributes,
    listeners,
    isDragging,
  };

  if (category === "transport") {
    return <TransportConnector {...props} sortable={sortable} />;
  }
  return <PlaceCard {...props} sortable={sortable} />;
}

function DragHandle({
  attributes,
  listeners,
}: {
  attributes: UseSortableReturn["attributes"];
  listeners: UseSortableReturn["listeners"];
}) {
  return (
    <button
      type="button"
      className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground"
      aria-label="ドラッグで並び替え"
      {...attributes}
      {...listeners}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="3" r="1.5" />
        <circle cx="11" cy="3" r="1.5" />
        <circle cx="5" cy="8" r="1.5" />
        <circle cx="11" cy="8" r="1.5" />
        <circle cx="5" cy="13" r="1.5" />
        <circle cx="11" cy="13" r="1.5" />
      </svg>
    </button>
  );
}

function ScheduleMenu({
  name,
  disabled,
  onEdit,
  onDelete,
  onUnassign,
}: {
  name: string;
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onUnassign?: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            aria-label={`${name}のメニュー`}
            disabled={disabled}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-3 w-3" />
            編集
          </DropdownMenuItem>
          {onUnassign && (
            <DropdownMenuItem onClick={onUnassign}>
              <Undo2 className="mr-2 h-3 w-3" />
              候補に戻す
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-3 w-3" />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>予定を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{name}」を削除します。この操作は取り消せません。
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

function PlaceCard({
  id,
  name,
  category,
  address,
  url,
  startTime,
  endTime,
  memo,
  departurePlace,
  arrivalPlace,
  transportMethod,
  color = "blue",
  updatedAt,
  tripId,
  dayId,
  patternId,
  onDelete,
  onUpdate,
  onUnassign,
  disabled,
  isFirst,
  isLast,
  timeStatus,
  selectable,
  selected,
  onSelect,
  sortable,
}: ScheduleItemProps & { sortable: SortableProps }) {
  const [editOpen, setEditOpen] = useState(false);
  const CategoryIcon = CATEGORY_ICONS[category];
  const colorClasses = SCHEDULE_COLOR_CLASSES[color];
  const isPast = timeStatus === "past";
  const isCurrent = timeStatus === "current";

  const timeStr = formatTimeRange(startTime, endTime);

  return (
    <div
      ref={sortable.nodeRef}
      style={sortable.style}
      className={cn("flex gap-3 py-1.5", sortable.isDragging && "opacity-50")}
    >
      {/* Timeline node with line segments */}
      <div className="flex flex-col items-center" aria-hidden="true">
        <div
          className={cn(
            "w-px flex-1",
            isFirst
              ? "border-transparent"
              : cn(
                  "border-l",
                  isPast
                    ? `border-solid ${colorClasses.border}`
                    : "border-dashed border-muted-foreground/30",
                ),
          )}
        />
        <div className="relative flex shrink-0 items-center justify-center">
          {isCurrent && (
            <span
              className={cn(
                "absolute h-7 w-7 animate-ping rounded-full opacity-30",
                colorClasses.bg,
              )}
            />
          )}
          <div
            className={cn(
              "relative flex h-7 w-7 items-center justify-center rounded-full text-white",
              colorClasses.bg,
              isPast && "opacity-50",
              isCurrent && `ring-2 ring-offset-2 ring-offset-background ${colorClasses.ring}`,
            )}
          >
            <CategoryIcon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div
          className={cn(
            "w-px flex-1",
            isLast
              ? "border-transparent"
              : cn(
                  "border-l",
                  isPast
                    ? `border-solid ${colorClasses.border}`
                    : "border-dashed border-muted-foreground/30",
                ),
          )}
        />
      </div>

      {/* Card body */}
      <div
        className={cn(
          "min-w-0 flex-1 rounded-md border p-3",
          isPast && "opacity-50",
          selectable && "cursor-pointer transition-colors hover:bg-accent/50",
          selectable && selected && SELECTED_RING,
        )}
        {...(selectable
          ? {
              onClick: () => onSelect?.(id),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(id);
                }
              },
              role: "button" as const,
              tabIndex: 0,
              "aria-pressed": selected,
            }
          : {})}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {selectable ? (
              <SelectionIndicator checked={!!selected} />
            ) : (
              <DragHandle attributes={sortable.attributes} listeners={sortable.listeners} />
            )}
            <span className="font-medium">{name}</span>
            {timeStr && <span className="text-xs text-muted-foreground">{timeStr}</span>}
          </div>
          {!selectable && (
            <ScheduleMenu
              name={name}
              disabled={disabled}
              onEdit={() => setEditOpen(true)}
              onDelete={onDelete}
              onUnassign={onUnassign}
            />
          )}
        </div>
        {(address || url || memo) && (
          <div className="mt-1 space-y-0.5">
            {address && <p className="text-xs text-muted-foreground">{address}</p>}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-xs text-blue-600 hover:underline"
              >
                {url}
              </a>
            )}
            {memo && <p className="text-sm text-muted-foreground">{memo}</p>}
          </div>
        )}
      </div>

      <EditScheduleDialog
        tripId={tripId}
        dayId={dayId}
        patternId={patternId}
        schedule={{
          id,
          name,
          category,
          address,
          url,
          startTime,
          endTime,
          memo,
          departurePlace,
          arrivalPlace,
          transportMethod,
          color,
          updatedAt,
          sortOrder: 0,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdate={onUpdate}
      />
    </div>
  );
}

function TransportConnector({
  id,
  name,
  category,
  address,
  url,
  startTime,
  endTime,
  memo,
  departurePlace,
  arrivalPlace,
  transportMethod,
  color = "blue",
  updatedAt,
  tripId,
  dayId,
  patternId,
  onDelete,
  onUpdate,
  onUnassign,
  disabled,
  isFirst,
  isLast,
  timeStatus,
  selectable,
  selected,
  onSelect,
  sortable,
}: ScheduleItemProps & { sortable: SortableProps }) {
  const [editOpen, setEditOpen] = useState(false);
  const colorClasses = SCHEDULE_COLOR_CLASSES[color];
  const isPast = timeStatus === "past";
  const isCurrent = timeStatus === "current";
  const TransportIcon = transportMethod
    ? TRANSPORT_ICONS[transportMethod as TransportMethod]
    : CATEGORY_ICONS.transport;

  const routeStr =
    departurePlace && arrivalPlace
      ? `${departurePlace} → ${arrivalPlace}`
      : departurePlace || arrivalPlace || "";

  const methodLabel = transportMethod
    ? TRANSPORT_METHOD_LABELS[transportMethod as TransportMethod]
    : "";

  const timeStr = startTime ? formatTime(startTime) : "";

  return (
    <div
      ref={sortable.nodeRef}
      style={sortable.style}
      className={cn("flex gap-3 py-0.5", sortable.isDragging && "opacity-50")}
    >
      {/* Timeline node with line segments */}
      <div className="flex w-7 flex-col items-center" aria-hidden="true">
        <div
          className={cn(
            "w-px flex-1",
            isFirst
              ? "border-transparent"
              : cn(
                  "border-l",
                  isPast
                    ? `border-solid ${colorClasses.border}`
                    : "border-dashed border-muted-foreground/30",
                ),
          )}
        />
        <div className="relative flex shrink-0 items-center justify-center">
          {isCurrent && (
            <span
              className={cn(
                "absolute h-5 w-5 animate-ping rounded-full opacity-30",
                colorClasses.bg,
              )}
            />
          )}
          <div
            className={cn(
              "relative flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white",
              colorClasses.border,
              isPast && "opacity-50",
              isCurrent && `ring-2 ring-offset-1 ring-offset-background ${colorClasses.ring}`,
            )}
          >
            <TransportIcon className={cn("h-2.5 w-2.5", colorClasses.text)} />
          </div>
        </div>
        <div
          className={cn(
            "w-px flex-1",
            isLast
              ? "border-transparent"
              : cn(
                  "border-l",
                  isPast
                    ? `border-solid ${colorClasses.border}`
                    : "border-dashed border-muted-foreground/30",
                ),
          )}
        />
      </div>

      {/* Compact connector row */}
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded border border-dashed px-3 py-1.5",
          isPast && "opacity-50",
          selectable && "cursor-pointer transition-colors hover:bg-accent/50",
          selectable && selected && SELECTED_RING,
        )}
        {...(selectable
          ? {
              onClick: () => onSelect?.(id),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(id);
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
        ) : (
          <DragHandle attributes={sortable.attributes} listeners={sortable.listeners} />
        )}
        {routeStr && <span className="truncate text-sm text-muted-foreground">{routeStr}</span>}
        {methodLabel && (
          <span className="shrink-0 text-xs text-muted-foreground">({methodLabel})</span>
        )}
        {timeStr && <span className="shrink-0 text-xs text-muted-foreground">{timeStr}</span>}
        {!selectable && (
          <div className="ml-auto">
            <ScheduleMenu
              name={name}
              disabled={disabled}
              onEdit={() => setEditOpen(true)}
              onDelete={onDelete}
              onUnassign={onUnassign}
            />
          </div>
        )}
      </div>

      <EditScheduleDialog
        tripId={tripId}
        dayId={dayId}
        patternId={patternId}
        schedule={{
          id,
          name,
          category,
          address,
          url,
          startTime,
          endTime,
          memo,
          departurePlace,
          arrivalPlace,
          transportMethod,
          color,
          updatedAt,
          sortOrder: 0,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdate={onUpdate}
      />
    </div>
  );
}
