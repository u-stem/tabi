"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { usePullToRefresh } from "@/lib/hooks/use-pull-to-refresh";

const THRESHOLD = 80;

type SpScrollContextValue = {
  ref: React.RefObject<HTMLDivElement | null>;
  activeScrollElement: HTMLElement | null;
  setActiveScrollElement: (el: HTMLElement | null) => void;
};

const SpScrollContext = createContext<SpScrollContextValue | null>(null);

export function useSpScrollContainer() {
  const ctx = useContext(SpScrollContext);
  return ctx?.ref ?? null;
}

export function useSpActiveScrollElement() {
  const ctx = useContext(SpScrollContext);
  return ctx?.activeScrollElement ?? null;
}

export function useSetActiveScrollElement() {
  const ctx = useContext(SpScrollContext);
  return ctx?.setActiveScrollElement ?? null;
}

export function SpScrollContainer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeScrollElement, setActiveScrollElement] = useState<HTMLElement | null>(null);
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  const { pulling, pullDistance, refreshing } = usePullToRefresh(
    ref,
    activeScrollElement,
    handleRefresh,
  );

  const visible = pulling || refreshing;
  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const height = pulling ? pullDistance : refreshing ? 48 : 0;

  // Only re-render consumers when activeScrollElement changes
  const contextValue = useMemo(
    () => ({ ref, activeScrollElement, setActiveScrollElement }),
    [activeScrollElement],
  );

  return (
    <SpScrollContext.Provider value={contextValue}>
      <div
        ref={ref}
        className={`sp-layout min-h-0 flex-1 touch-pan-y overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${activeScrollElement ? "overflow-y-hidden" : "overflow-y-auto"}`}
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
