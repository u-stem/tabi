"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { createContext, useCallback, useContext, useRef } from "react";
import { usePullToRefresh } from "@/lib/hooks/use-pull-to-refresh";

const THRESHOLD = 80;

const SpScrollContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null);

export function useSpScrollContainer() {
  return useContext(SpScrollContext);
}

export function SpScrollContainer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  const { pulling, pullDistance, refreshing } = usePullToRefresh(ref, handleRefresh);

  const visible = pulling || refreshing;
  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const height = pulling ? pullDistance : refreshing ? 48 : 0;

  return (
    <SpScrollContext.Provider value={ref}>
      <div
        ref={ref}
        className="sp-layout min-h-0 flex-1 overflow-y-auto touch-pan-y overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {visible && (
          <div className="flex items-center justify-center overflow-hidden" style={{ height }}>
            <Loader2
              className={`h-5 w-5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`}
              style={{
                opacity: refreshing ? 1 : progress,
                transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
              }}
            />
          </div>
        )}
        {children}
      </div>
    </SpScrollContext.Provider>
  );
}
