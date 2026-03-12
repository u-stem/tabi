import type { ReactNode } from "react";
import { memo } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  message: string;
  variant: "box" | "page" | "inline";
  className?: string;
  action?: ReactNode;
};

export const EmptyState = memo(function EmptyState({
  message,
  variant,
  className,
  action,
}: EmptyStateProps) {
  if (variant === "box") {
    return (
      <div
        className={cn(
          "flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border border-dashed text-center",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">{message}</p>
        {action}
      </div>
    );
  }
  if (variant === "page") {
    return (
      <div className={cn("mt-8 text-center", className)}>
        <p className="text-muted-foreground">{message}</p>
        {action}
      </div>
    );
  }
  return (
    <div className={cn("py-8 text-center", className)}>
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
});
