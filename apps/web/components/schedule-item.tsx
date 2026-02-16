"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  ScheduleCategory,
  ScheduleColor,
  ScheduleResponse,
  TimeDelta,
  TransportMethod,
} from "@sugara/shared";
import { shiftTime, TRANSPORT_METHOD_LABELS } from "@sugara/shared";
import {
  ExternalLink,
  MapPin,
  MoreHorizontal,
  Pencil,
  Route,
  StickyNote,
  Trash2,
  Undo2,
} from "lucide-react";
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
import { getCrossDayLabel, getStartDayLabel } from "@/lib/cross-day-label";
import type { TimeStatus } from "@/lib/format";
import { formatTime, formatTimeRange, isSafeUrl } from "@/lib/format";
import { CATEGORY_ICONS, TRANSPORT_ICONS } from "@/lib/icons";
import { buildTransportUrl } from "@/lib/transport-link";
import { cn } from "@/lib/utils";
import { BatchShiftDialog } from "./batch-shift-dialog";
import { DragHandle } from "./drag-handle";
import { EditScheduleDialog } from "./edit-schedule-dialog";

type ScheduleItemProps = {
  id: string;
  name: string;
  category: ScheduleCategory;
  address?: string | null;
  urls: string[];
  startTime?: string | null;
  endTime?: string | null;
  endDayOffset?: number | null;
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
  maxEndDayOffset?: number;
  /** When true, display endTime only and hide endDayOffset label (cross-day target view) */
  crossDayDisplay?: boolean;
  /** Source day number for cross-day display (e.g. "1日目から継続") */
  crossDaySourceDayNumber?: number;
  /** Position within multi-day span: "intermediate" or "final" */
  crossDayPosition?: "intermediate" | "final";
  /** Subsequent schedules for batch time shift (sorted by sortOrder) */
  siblingSchedules?: ScheduleResponse[];
  /** ISO date string (YYYY-MM-DD) for transit search links */
  date?: string;
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
  const { id, category, disabled, selectable, crossDayDisplay } = props;
  // Cross-day entries use a prefixed ID so they don't collide with same-day
  // schedule IDs in SortableContext. They register as drop targets but can't
  // be dragged (disabled: true).
  const sortableId = crossDayDisplay ? `cross-${id}` : id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    disabled: disabled || selectable || crossDayDisplay,
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

function partitionShiftTargets(
  schedules: ScheduleResponse[],
  delta: number,
): { shiftable: ScheduleResponse[]; skipped: ScheduleResponse[] } {
  const shiftable: ScheduleResponse[] = [];
  const skipped: ScheduleResponse[] = [];
  for (const s of schedules) {
    if (!s.startTime && !s.endTime) continue;
    if (s.category === "hotel" && s.endDayOffset && s.endDayOffset > 0) {
      skipped.push(s);
      continue;
    }
    const canShiftStart = s.startTime ? shiftTime(s.startTime, delta) !== null : true;
    const canShiftEnd =
      !s.endTime || (s.endDayOffset && s.endDayOffset > 0)
        ? true
        : shiftTime(s.endTime, delta) !== null;
    if (canShiftStart && canShiftEnd) {
      shiftable.push(s);
    } else {
      skipped.push(s);
    }
  }
  return { shiftable, skipped };
}

function useShiftProposal(siblingSchedules?: ScheduleResponse[]) {
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [shiftDelta, setShiftDelta] = useState(0);
  const [shiftSource, setShiftSource] = useState<"start" | "end">("start");
  const [shiftTargets, setShiftTargets] = useState<ScheduleResponse[]>([]);
  const [shiftSkipped, setShiftSkipped] = useState<ScheduleResponse[]>([]);

  const onShiftProposal =
    siblingSchedules && siblingSchedules.length > 0
      ? (timeDelta: TimeDelta) => {
          const { shiftable, skipped } = partitionShiftTargets(siblingSchedules, timeDelta.delta);
          if (shiftable.length > 0) {
            setShiftDelta(timeDelta.delta);
            setShiftSource(timeDelta.source);
            setShiftTargets(shiftable);
            setShiftSkipped(skipped);
            setShiftDialogOpen(true);
          }
        }
      : undefined;

  return {
    shiftDialogOpen,
    setShiftDialogOpen,
    shiftDelta,
    shiftSource,
    shiftTargets,
    shiftSkipped,
    onShiftProposal,
  };
}

function TimelineNode({
  variant,
  icon: Icon,
  isFirst,
  isLast,
  isPast,
  isCurrent,
  colorClasses,
}: {
  variant: "place" | "transport";
  icon: React.ComponentType<{ className?: string }>;
  isFirst?: boolean;
  isLast?: boolean;
  isPast: boolean;
  isCurrent: boolean;
  colorClasses: (typeof SCHEDULE_COLOR_CLASSES)[ScheduleColor];
}) {
  const isPlace = variant === "place";
  const nodeSize = isPlace ? "h-7 w-7" : "h-5 w-5";
  const iconSize = isPlace ? "h-3.5 w-3.5" : "h-2.5 w-2.5";
  const ringOffset = isPlace ? "ring-offset-2" : "ring-offset-1";

  const lineSegment = (hidden: boolean) => (
    <div
      className={cn(
        "w-px flex-1",
        hidden
          ? "border-transparent"
          : cn(
              "border-l",
              isPast
                ? `border-solid ${colorClasses.border}`
                : "border-dashed border-muted-foreground/30",
            ),
      )}
    />
  );

  return (
    <div className={cn("flex flex-col items-center", !isPlace && "w-7")} aria-hidden="true">
      {lineSegment(!!isFirst)}
      <div className="relative flex shrink-0 items-center justify-center">
        {isCurrent && (
          <span
            className={cn(
              "absolute animate-ping rounded-full opacity-30",
              nodeSize,
              colorClasses.bg,
            )}
          />
        )}
        <div
          className={cn(
            "relative flex items-center justify-center rounded-full",
            nodeSize,
            isPlace
              ? cn("text-white", colorClasses.bg)
              : cn("border-2 bg-background", colorClasses.border),
            isPast && "opacity-50",
            isCurrent && `ring-2 ${ringOffset} ring-offset-background ${colorClasses.ring}`,
          )}
        >
          <Icon className={cn(iconSize, !isPlace && colorClasses.text)} />
        </div>
      </div>
      {lineSegment(!!isLast)}
    </div>
  );
}

function ScheduleItemDialogs({
  tripId,
  dayId,
  patternId,
  schedule,
  editOpen,
  onEditOpenChange,
  onUpdate,
  maxEndDayOffset,
  shift,
}: {
  tripId: string;
  dayId: string;
  patternId: string;
  schedule: {
    id: string;
    name: string;
    category: ScheduleCategory;
    address?: string | null;
    urls: string[];
    startTime?: string | null;
    endTime?: string | null;
    endDayOffset?: number | null;
    memo?: string | null;
    departurePlace?: string | null;
    arrivalPlace?: string | null;
    transportMethod?: string | null;
    color?: ScheduleColor;
    updatedAt: string;
  };
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  maxEndDayOffset?: number;
  shift: ReturnType<typeof useShiftProposal>;
}) {
  return (
    <>
      <EditScheduleDialog
        tripId={tripId}
        dayId={dayId}
        patternId={patternId}
        schedule={{
          ...schedule,
          color: schedule.color ?? "blue",
          urls: schedule.urls,
          sortOrder: 0,
        }}
        open={editOpen}
        onOpenChange={onEditOpenChange}
        onUpdate={onUpdate}
        maxEndDayOffset={maxEndDayOffset}
        onShiftProposal={shift.onShiftProposal}
      />
      <BatchShiftDialog
        open={shift.shiftDialogOpen}
        onOpenChange={shift.setShiftDialogOpen}
        tripId={tripId}
        dayId={dayId}
        patternId={patternId}
        scheduleName={schedule.name}
        deltaMinutes={shift.shiftDelta}
        deltaSource={shift.shiftSource}
        targetSchedules={shift.shiftTargets}
        skippedSchedules={shift.shiftSkipped}
        onDone={onUpdate}
      />
    </>
  );
}

function PlaceCard({
  id,
  name,
  category,
  address,
  urls,
  startTime,
  endTime,
  endDayOffset,
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
  maxEndDayOffset,
  crossDayDisplay,
  crossDaySourceDayNumber,
  crossDayPosition,
  siblingSchedules,
}: ScheduleItemProps & { sortable: SortableProps }) {
  const [editOpen, setEditOpen] = useState(false);
  const shift = useShiftProposal(siblingSchedules);
  const CategoryIcon = CATEGORY_ICONS[category];
  const colorClasses = SCHEDULE_COLOR_CLASSES[color];
  const isPast = timeStatus === "past";
  const isCurrent = timeStatus === "current";

  // Cross-day target: show only endTime. Normal: hide endTime if endDayOffset set.
  const visibleStartTime = crossDayDisplay ? endTime : startTime;
  const visibleEndTime = crossDayDisplay || endDayOffset ? null : endTime;
  const timeStr = formatTimeRange(visibleStartTime, visibleEndTime);

  return (
    <div
      ref={sortable.nodeRef}
      style={sortable.style}
      className={cn("flex gap-3 py-1.5", sortable.isDragging && "opacity-50")}
    >
      <TimelineNode
        variant="place"
        icon={CategoryIcon}
        isFirst={isFirst}
        isLast={isLast}
        isPast={isPast}
        isCurrent={isCurrent}
        colorClasses={colorClasses}
      />

      {/* Card body */}
      <div
        className={cn(
          "min-w-0 flex-1 rounded-md border p-3",
          isPast && "opacity-50",
          crossDayDisplay && "border-dashed bg-muted/30",
          selectable &&
            "cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
          : crossDayDisplay && crossDaySourceDayNumber
            ? {
                role: "group" as const,
                "aria-label": `${getCrossDayLabel(category, crossDayPosition!) ?? `${crossDaySourceDayNumber}日目から継続`}: ${name}`,
              }
            : {})}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {selectable ? (
              <SelectionIndicator checked={!!selected} />
            ) : !crossDayDisplay ? (
              <DragHandle attributes={sortable.attributes} listeners={sortable.listeners} />
            ) : (
              <span className="inline-block w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="text-sm font-medium">{name}</span>
            {!crossDayDisplay &&
              endDayOffset != null &&
              endDayOffset > 0 &&
              (() => {
                const label = getStartDayLabel(category);
                return label ? (
                  <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {label}
                  </span>
                ) : null;
              })()}
            {crossDayDisplay &&
              crossDayPosition &&
              (() => {
                const label = getCrossDayLabel(category, crossDayPosition);
                return label ? (
                  <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {label}
                  </span>
                ) : null;
              })()}
            {crossDayDisplay && timeStr && (
              <span className="text-xs text-muted-foreground">~ {timeStr}</span>
            )}
            {!crossDayDisplay && timeStr && (
              <span className="text-xs text-muted-foreground">
                {timeStr}
                {endDayOffset != null && endDayOffset > 0 ? " ~" : ""}
              </span>
            )}
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
        {(address || urls.length > 0 || memo) && (
          <div className="mt-1 space-y-1 pl-6">
            {address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                {address}
              </a>
            )}
            {urls.filter(isSafeUrl).map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate">{u.replace(/^https?:\/\//, "")}</span>
              </a>
            ))}
            {memo && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/70" />
                <p className="line-clamp-2">{memo}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <ScheduleItemDialogs
        tripId={tripId}
        dayId={dayId}
        patternId={patternId}
        schedule={{
          id,
          name,
          category,
          address,
          urls,
          startTime,
          endTime,
          endDayOffset,
          memo,
          departurePlace,
          arrivalPlace,
          transportMethod,
          color,
          updatedAt,
        }}
        editOpen={editOpen}
        onEditOpenChange={setEditOpen}
        onUpdate={onUpdate}
        maxEndDayOffset={maxEndDayOffset}
        shift={shift}
      />
    </div>
  );
}

function TransportConnector({
  id,
  name,
  category,
  address,
  urls,
  startTime,
  endTime,
  endDayOffset,
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
  maxEndDayOffset,
  crossDayDisplay,
  crossDaySourceDayNumber,
  crossDayPosition,
  siblingSchedules,
  date,
}: ScheduleItemProps & { sortable: SortableProps }) {
  const [editOpen, setEditOpen] = useState(false);
  const shift = useShiftProposal(siblingSchedules);
  const colorClasses = SCHEDULE_COLOR_CLASSES[color];
  const isPast = timeStatus === "past";
  const isCurrent = timeStatus === "current";
  const TransportIcon = transportMethod
    ? TRANSPORT_ICONS[transportMethod as TransportMethod]
    : CATEGORY_ICONS.transport;

  // Cross-day target: show arrival only since departure is on the source day
  const routeStr = crossDayDisplay
    ? arrivalPlace || ""
    : departurePlace && arrivalPlace
      ? `${departurePlace} → ${arrivalPlace}`
      : departurePlace || arrivalPlace || "";

  const methodLabel = transportMethod
    ? TRANSPORT_METHOD_LABELS[transportMethod as TransportMethod]
    : "";

  const timeStr = crossDayDisplay
    ? endTime
      ? formatTime(endTime)
      : ""
    : startTime
      ? endTime && (endDayOffset == null || endDayOffset === 0)
        ? `${formatTime(startTime)} - ${formatTime(endTime)}`
        : formatTime(startTime)
      : "";

  const transitUrl =
    departurePlace && arrivalPlace
      ? buildTransportUrl({
          from: departurePlace,
          to: arrivalPlace,
          method: transportMethod,
          date,
          time: startTime,
        })
      : null;

  return (
    <div
      ref={sortable.nodeRef}
      style={sortable.style}
      className={cn("flex gap-3 py-0.5", sortable.isDragging && "opacity-50")}
    >
      <TimelineNode
        variant="transport"
        icon={TransportIcon}
        isFirst={isFirst}
        isLast={isLast}
        isPast={isPast}
        isCurrent={isCurrent}
        colorClasses={colorClasses}
      />

      {/* Card body */}
      <div
        className={cn(
          "min-w-0 flex-1 rounded-md border p-3",
          isPast && "opacity-50",
          crossDayDisplay && "border-dashed bg-muted/30",
          selectable &&
            "cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
          : crossDayDisplay && crossDaySourceDayNumber
            ? {
                role: "group" as const,
                "aria-label": `${getCrossDayLabel(category, crossDayPosition!) ?? `${crossDaySourceDayNumber}日目から`}: ${name}`,
              }
            : {})}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {selectable ? (
              <SelectionIndicator checked={!!selected} />
            ) : !crossDayDisplay ? (
              <DragHandle attributes={sortable.attributes} listeners={sortable.listeners} />
            ) : (
              <span className="inline-block w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="text-sm font-medium">{name}</span>
            {crossDayDisplay &&
              crossDayPosition &&
              (() => {
                const label = getCrossDayLabel(category, crossDayPosition);
                return label ? (
                  <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {label}
                  </span>
                ) : null;
              })()}
            {crossDayDisplay && timeStr && (
              <span className="text-xs text-muted-foreground">~ {timeStr}</span>
            )}
            {!crossDayDisplay && timeStr && (
              <span className="text-xs text-muted-foreground">
                {timeStr}
                {endDayOffset != null && endDayOffset > 0 ? " ~" : ""}
              </span>
            )}
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
        {(routeStr || urls.length > 0 || memo) && (
          <div className="mt-1 space-y-1 pl-6">
            {routeStr && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Route className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                {transitUrl ? (
                  <a
                    href={transitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {crossDayDisplay && arrivalPlace ? `→ ${routeStr}` : routeStr}
                  </a>
                ) : (
                  <span>{crossDayDisplay && arrivalPlace ? `→ ${routeStr}` : routeStr}</span>
                )}
                {methodLabel && <span className="shrink-0">({methodLabel})</span>}
              </span>
            )}
            {urls.filter(isSafeUrl).map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate">{u.replace(/^https?:\/\//, "")}</span>
              </a>
            ))}
            {memo && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/70" />
                <p className="line-clamp-2">{memo}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <ScheduleItemDialogs
        tripId={tripId}
        dayId={dayId}
        patternId={patternId}
        schedule={{
          id,
          name,
          category,
          address,
          urls,
          startTime,
          endTime,
          endDayOffset,
          memo,
          departurePlace,
          arrivalPlace,
          transportMethod,
          color,
          updatedAt,
        }}
        editOpen={editOpen}
        onEditOpenChange={setEditOpen}
        onUpdate={onUpdate}
        maxEndDayOffset={maxEndDayOffset}
        shift={shift}
      />
    </div>
  );
}
