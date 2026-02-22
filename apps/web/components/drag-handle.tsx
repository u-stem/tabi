import type { useSortable } from "@dnd-kit/sortable";

type DragHandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
};

export function DragHandle({ attributes, listeners }: DragHandleProps) {
  return (
    <button
      type="button"
      // min-h/min-w 44px for mobile touch target (Apple HIG)
      className="flex min-h-[44px] min-w-[44px] shrink-0 cursor-grab items-center justify-center touch-none text-muted-foreground hover:text-foreground sm:min-h-0 sm:min-w-0"
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
