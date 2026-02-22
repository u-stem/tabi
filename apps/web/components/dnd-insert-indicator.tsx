import { cn } from "@/lib/utils";

/**
 * @param overlay  When true, uses absolute positioning so the indicator
 *                 doesn't affect layout flow (prevents jitter during drag).
 *                 Use `overlay` for between-item indicators and omit it
 *                 for the "append to end" indicator at the bottom of a list.
 */
export function DndInsertIndicator({ overlay }: { overlay?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        overlay ? "pointer-events-none absolute inset-x-0 top-0 z-10 -translate-y-1/2" : "py-1",
      )}
      aria-hidden="true"
    >
      <div className="h-2 w-2 rounded-full bg-blue-500" />
      <div className="h-0.5 flex-1 bg-blue-500" />
    </div>
  );
}
