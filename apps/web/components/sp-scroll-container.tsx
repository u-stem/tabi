"use client";

import { createContext, useContext, useRef } from "react";

const SpScrollContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null);

export function useSpScrollContainer() {
  return useContext(SpScrollContext);
}

export function SpScrollContainer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <SpScrollContext.Provider value={ref}>
      <div
        ref={ref}
        className="sp-layout h-full overflow-y-auto touch-pan-y overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </SpScrollContext.Provider>
  );
}
