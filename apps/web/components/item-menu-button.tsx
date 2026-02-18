import { MoreHorizontal } from "lucide-react";
import { forwardRef } from "react";

export const ItemMenuButton = forwardRef<
  HTMLButtonElement,
  { ariaLabel: string; disabled?: boolean } & React.ComponentPropsWithoutRef<"button">
>(({ ariaLabel, disabled, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
    aria-label={ariaLabel}
    disabled={disabled}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
  </button>
));

ItemMenuButton.displayName = "ItemMenuButton";
