"use client";

import { Plus } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { useMobile } from "@/lib/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

// BottomNav h-12 (48px) + 32px spacing
const BOTTOM_NAV_CLEARANCE_PX = 80;

interface FabProps {
  onClick: () => void;
  label: string;
  hidden?: boolean;
  className?: string;
}

export function Fab({ onClick, label, hidden, className }: FabProps) {
  // In SP context MobileContext is true so lg:hidden is skipped,
  // allowing the FAB to appear even on desktop-sized viewports.
  const isMobile = useMobile();
  if (hidden) return null;

  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95",
        !isMobile && "lg:hidden",
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
