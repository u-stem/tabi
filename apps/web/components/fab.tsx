"use client";

import { Plus } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { useMobile } from "@/lib/hooks/use-is-mobile";
import { useScrollDirection } from "@/lib/hooks/use-scroll-direction";
import { cn } from "@/lib/utils";

// BottomNav h-16 (64px) + 32px spacing
const BOTTOM_NAV_CLEARANCE_PX = 96;

interface FabProps {
  onClick: () => void;
  label: string;
  hidden?: boolean;
  className?: string;
}

export function Fab({ onClick, label, hidden, className }: FabProps) {
  // Desktop layouts provide MobileContext=false so useMobile() returns false,
  // making the FAB always hidden regardless of viewport width.
  // SP layouts provide MobileContext=true so the FAB is always shown.
  const isMobile = useMobile();
  const scrollHidden = useScrollDirection();
  if (hidden) return null;

  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-[transform,opacity] duration-300 active:scale-95",
        !isMobile && "hidden",
        scrollHidden && "opacity-0 pointer-events-none scale-90",
        className,
      )}
      style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${BOTTOM_NAV_CLEARANCE_PX}px)` }}
      onClick={() => {
        haptics.light();
        onClick();
      }}
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
