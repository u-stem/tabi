import { MoreHorizontal } from "lucide-react";
import { forwardRef } from "react";

export const ItemMenuButton = forwardRef<
  HTMLButtonElement,
  { ariaLabel: string; disabled?: boolean } & React.ComponentPropsWithoutRef<"button">
>(({ ariaLabel, disabled, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className="flex shrink-0 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0"
    aria-label={ariaLabel}
    disabled={disabled}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
  </button>
));

ItemMenuButton.displayName = "ItemMenuButton";
