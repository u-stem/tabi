"use client";

import { Loader2 } from "lucide-react";
import { usePullToRefresh } from "@/lib/hooks/use-pull-to-refresh";
import { cn } from "@/lib/utils";

type PullToRefreshProps = {
  onRefresh: () => Promise<unknown>;
  enabled?: boolean;
  children: React.ReactNode;
};

export function PullToRefresh({ onRefresh, enabled = true, children }: PullToRefreshProps) {
  const { refreshing, pullDistance, threshold } = usePullToRefresh({ onRefresh, enabled });

  const showIndicator = pullDistance > 0 || refreshing;
  const ready = pullDistance >= threshold;

  return (
    <div>
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden transition-[height] sm:hidden",
          refreshing && "h-10",
        )}
        style={!refreshing ? { height: `${pullDistance}px` } : undefined}
      >
        {showIndicator && (
          <Loader2
            className={cn("h-5 w-5 text-muted-foreground", (refreshing || ready) && "animate-spin")}
          />
        )}
      </div>
      {children}
    </div>
  );
}
