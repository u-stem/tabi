"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";
import { getSeasonalBg, getSeasonalColors, getSeasonalGradient } from "@/lib/season";
import { cn } from "@/lib/utils";

export { getSeasonalBg, getSeasonalGradient };

export function Logo({ href, className }: { href?: string; className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [from, to] = getSeasonalColors();
  const baseGradient = `linear-gradient(to right, ${from}, ${to})`;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      // Override Tailwind gradient with radial highlight + linear base
      el.style.backgroundImage = `radial-gradient(circle 30px at ${x}% ${y}%, rgba(255,255,255,0.5) 0%, transparent 100%), ${baseGradient}`;
    },
    [baseGradient],
  );

  const clearHighlight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Clear inline style so Tailwind gradient takes over again
    el.style.backgroundImage = "";
  }, []);

  const gradient = getSeasonalGradient();
  const style = cn(
    "bg-gradient-to-r bg-clip-text text-xl font-bold tracking-tight text-transparent",
    gradient,
    className,
  );

  if (href) {
    return (
      <Link
        ref={ref}
        href={href}
        className={style}
        onMouseMove={handleMouseMove}
        onMouseLeave={clearHighlight}
        onTouchEnd={clearHighlight}
      >
        sugara
      </Link>
    );
  }

  return <span className={cn(style)}>sugara</span>;
}
