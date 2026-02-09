"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SpotCategory, SpotColor, TransportMethod } from "@tabi/shared";
import { TRANSPORT_METHOD_LABELS } from "@tabi/shared";
import { Pencil, Trash2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SPOT_COLOR_CLASSES } from "@/lib/colors";
import { formatTime, formatTimeRange } from "@/lib/format";
import { CATEGORY_ICONS, TRANSPORT_ICONS } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { EditSpotDialog } from "./edit-spot-dialog";

type SpotItemProps = {
  id: string;
  name: string;
  category: SpotCategory;
  address?: string | null;
  url?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
  departurePlace?: string | null;
  arrivalPlace?: string | null;
  transportMethod?: string | null;
  color?: SpotColor;
  tripId: string;
  dayId: string;
  onDelete: () => void;
  onUpdate: () => void;
  disabled?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
};

type UseSortableReturn = ReturnType<typeof useSortable>;

type SortableProps = {
  nodeRef: UseSortableReturn["setNodeRef"];
  style: CSSProperties;
  attributes: UseSortableReturn["attributes"];
  listeners: UseSortableReturn["listeners"];
  isDragging: boolean;
};

export function SpotItem(props: SpotItemProps) {
  const { id, category, disabled } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
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

function DeleteConfirmDialog({
  name,
  disabled,
  onDelete,
}: {
  name: string;
  disabled?: boolean;
  onDelete: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-0.5 text-xs text-destructive hover:text-destructive/80 disabled:pointer-events-none disabled:opacity-50"
          aria-label={`${name}を削除`}
          disabled={disabled}
        >
          <Trash2 className="h-3 w-3" />
          削除
        </button>
      </AlertDialogTrigger>
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
  tripId,
  dayId,
  onDelete,
  onUpdate,
  disabled,
  isFirst,
  isLast,
  sortable,
}: SpotItemProps & { sortable: SortableProps }) {
  const [editOpen, setEditOpen] = useState(false);
  const CategoryIcon = CATEGORY_ICONS[category];
  const colorClasses = SPOT_COLOR_CLASSES[color];

  const timeStr = formatTimeRange(startTime, endTime);

  return (
    <div
      ref={sortable.nodeRef}
      style={sortable.style}
      className={cn("flex gap-3 py-1", sortable.isDragging && "opacity-50")}
    >
      {/* Timeline node with line segments */}
      <div className="flex flex-col items-center" aria-hidden="true">
        <div
          className={cn(
            "w-px flex-1",
            isFirst ? "border-transparent" : "border-l border-dashed border-muted-foreground/30",
          )}
        />
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white",
            colorClasses.bg,
          )}
        >
          <CategoryIcon className="h-3.5 w-3.5" />
        </div>
        <div
          className={cn(
            "w-px flex-1",
            isLast ? "border-transparent" : "border-l border-dashed border-muted-foreground/30",
          )}
        />
      </div>

      {/* Card body */}
      <div className="min-w-0 flex-1 rounded-md border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <DragHandle attributes={sortable.attributes} listeners={sortable.listeners} />
            <span className="font-medium">{name}</span>
            {timeStr && <span className="text-xs text-muted-foreground">{timeStr}</span>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              aria-label={`${name}を編集`}
              disabled={disabled}
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3 w-3" />
              編集
            </button>
            <DeleteConfirmDialog name={name} disabled={disabled} onDelete={onDelete} />
          </div>
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

      <EditSpotDialog
        tripId={tripId}
        dayId={dayId}
        spot={{
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
  tripId,
  dayId,
  onDelete,
  onUpdate,
  disabled,
  isFirst,
  isLast,
  sortable,
}: SpotItemProps & { sortable: SortableProps }) {
  const [editOpen, setEditOpen] = useState(false);
  const colorClasses = SPOT_COLOR_CLASSES[color];
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
            isFirst ? "border-transparent" : "border-l border-dashed border-muted-foreground/30",
          )}
        />
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white",
            colorClasses.border,
          )}
        >
          <TransportIcon className={cn("h-2.5 w-2.5", colorClasses.text)} />
        </div>
        <div
          className={cn(
            "w-px flex-1",
            isLast ? "border-transparent" : "border-l border-dashed border-muted-foreground/30",
          )}
        />
      </div>

      {/* Compact connector row */}
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded border border-dashed px-3 py-1.5">
        <DragHandle attributes={sortable.attributes} listeners={sortable.listeners} />
        <TransportIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {routeStr && <span className="truncate text-sm text-muted-foreground">{routeStr}</span>}
        {methodLabel && (
          <span className="shrink-0 text-xs text-muted-foreground">({methodLabel})</span>
        )}
        {timeStr && <span className="shrink-0 text-xs text-muted-foreground">{timeStr}</span>}
        <div className="ml-auto flex shrink-0 gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            aria-label={`${name}を編集`}
            disabled={disabled}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3 w-3" />
            編集
          </button>
          <DeleteConfirmDialog name={name} disabled={disabled} onDelete={onDelete} />
        </div>
      </div>

      <EditSpotDialog
        tripId={tripId}
        dayId={dayId}
        spot={{
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
          sortOrder: 0,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdate={onUpdate}
      />
    </div>
  );
}
