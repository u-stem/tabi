"use client";

import Link from "next/link";
import { getSeasonalBg, getSeasonalGradient } from "@/lib/season";
import { cn } from "@/lib/utils";

export { getSeasonalGradient, getSeasonalBg };

export function Logo({ href, className }: { href?: string; className?: string }) {
  const gradient = getSeasonalGradient();
  const style = cn(
    "bg-gradient-to-r bg-clip-text text-xl font-bold tracking-tight text-transparent",
    gradient,
    className,
  );

  if (href) {
    return (
      <Link href={href} className={style}>
        sugara
      </Link>
    );
  }

  return <span className={style}>sugara</span>;
}
