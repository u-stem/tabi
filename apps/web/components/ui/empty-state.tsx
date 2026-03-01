import { memo } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  message: string;
  variant: "box" | "page" | "inline";
  className?: string;
};

export const EmptyState = memo(function EmptyState({
  message,
  variant,
  className,
}: EmptyStateProps) {
  if (variant === "box") {
    return (
      <div
        className={cn(
          "flex min-h-24 items-center justify-center rounded-md border border-dashed text-center",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }
  if (variant === "page") {
    return (
      <p className={cn("mt-8 text-center text-muted-foreground", className)}>
        {message}
      </p>
    );
  }
  return (
    <div className={cn("py-8 text-center", className)}>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
});
