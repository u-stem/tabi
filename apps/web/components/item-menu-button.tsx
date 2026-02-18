import { MoreHorizontal } from "lucide-react";

export function ItemMenuButton({ ariaLabel, disabled }: { ariaLabel: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      aria-label={ariaLabel}
      disabled={disabled}
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  );
}
