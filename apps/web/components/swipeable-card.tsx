"use client";

import { useDrag } from "@use-gesture/react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface SwipeAction {
  label: string;
  icon?: ReactNode;
  color: "blue" | "red" | "green";
  onClick: () => void;
}

interface SwipeableCardProps {
  children: ReactNode;
  actions: SwipeAction[];
  disabled?: boolean;
  className?: string;
}

const ACTION_WIDTH = 72;
const EDGE_EXCLUSION = 20;

const COLOR_MAP = {
  blue: "bg-blue-500 text-white",
  red: "bg-red-500 text-white",
  green: "bg-green-500 text-white",
} as const;

export function SwipeableCard({ children, actions, disabled, className }: SwipeableCardProps) {
  const [offset, setOffset] = useState(0);
  const revealed = useRef(false);
  const maxOffset = actions.length * ACTION_WIDTH;

  const bind = useDrag(
    ({ active, movement: [mx], xy: [startX], first, memo }) => {
      if (disabled || actions.length === 0) return;

      if (first && startX < EDGE_EXCLUSION) return;

      if (first) {
        return { startOffset: revealed.current ? -maxOffset : 0 };
      }

      const startOffset = (memo as { startOffset: number })?.startOffset ?? 0;
      const newOffset = Math.max(-maxOffset, Math.min(0, startOffset + mx));

      if (active) {
        setOffset(newOffset);
      } else {
        const threshold = maxOffset * 0.4;
        if (Math.abs(newOffset) > threshold) {
          setOffset(-maxOffset);
          revealed.current = true;
          haptics.light();
        } else {
          setOffset(0);
          revealed.current = false;
        }
      }

      return memo;
    },
    { axis: "x", filterTaps: true },
  );

  function close() {
    setOffset(0);
    revealed.current = false;
  }

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-y-0 right-0 flex">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            aria-label={action.label}
            className={cn("flex w-[72px] items-center justify-center", COLOR_MAP[action.color])}
            onClick={() => {
              action.onClick();
              close();
            }}
          >
            <div className="flex flex-col items-center gap-1">
              {action.icon}
              <span className="text-xs">{action.label}</span>
            </div>
          </button>
        ))}
      </div>

      <div
        {...bind()}
        className="relative bg-background transition-transform duration-150 ease-out"
        style={{
          transform: `translateX(${offset}px)`,
          touchAction: "pan-y",
          transitionDuration: offset === 0 || offset === -maxOffset ? "150ms" : "0ms",
        }}
        onPointerUp={() => {
          if (revealed.current) close();
        }}
      >
        {children}
      </div>
    </div>
  );
}
