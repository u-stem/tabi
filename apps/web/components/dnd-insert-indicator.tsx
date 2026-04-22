import { cn } from "@/lib/utils";

/**
 * @param overlay  When true, uses absolute positioning so the indicator
 *                 doesn't affect layout flow (prevents jitter during drag).
 *                 Use `overlay` for between-item indicators and omit it
 *                 for the "append to end" indicator at the bottom of a list.
 * @param position In overlay mode, which edge of the hovered card to render
 *                 on — `"top"` (default) shows the line just above the card
 *                 (drop will land before it), `"bottom"` shows it just below
 *                 (drop will land after it). Ignored when `overlay` is false.
 */
export function DndInsertIndicator({
  overlay,
  position = "top",
}: {
  overlay?: boolean;
  position?: "top" | "bottom";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        overlay
          ? cn(
              "pointer-events-none absolute inset-x-0 z-10",
              position === "top" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2",
            )
          : "py-1",
      )}
      aria-hidden="true"
    >
      <div className="h-2 w-2 rounded-full bg-blue-500" />
      <div className="h-0.5 flex-1 bg-blue-500" />
    </div>
  );
}
