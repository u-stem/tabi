"use client";

import { defaultAnimateLayoutChanges, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { memo } from "react";
import { PlaceItem } from "./schedule-items/place-item";
import type { ScheduleItemProps, SortableProps } from "./schedule-items/primitives";
import { TransportItem } from "./schedule-items/transport-item";

export type { ScheduleItemProps };

export const ScheduleItem = memo(function ScheduleItem(props: ScheduleItemProps) {
  const { id, category, disabled, selectable, crossDayDisplay, draggable, reorderable } = props;
  // Cross-day entries use a prefixed ID so they don't collide with same-day
  // schedule IDs in SortableContext. They act as drop targets but cannot be
  // dragged (listeners are omitted below).
  const sortableId = crossDayDisplay ? `cross-${id}` : id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    animateLayoutChanges: defaultAnimateLayoutChanges,
    // crossDayDisplay is excluded from disabled so it acts as a drop target,
    // but listeners are omitted below to prevent dragging cross-day entries.
    disabled: disabled || selectable || reorderable || draggable === false,
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
    listeners: crossDayDisplay ? undefined : listeners,
    isDragging,
  };

  if (category === "transport") {
    return <TransportItem {...props} sortable={sortable} />;
  }
  return <PlaceItem {...props} sortable={sortable} />;
});
