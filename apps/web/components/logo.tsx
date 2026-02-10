"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function getSeasonalGradient(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) {
    return "from-pink-400 to-purple-400";
  }
  if (month >= 6 && month <= 8) {
    return "from-green-500 to-teal-400";
  }
  if (month >= 9 && month <= 11) {
    return "from-amber-500 to-red-500";
  }
  return "from-blue-400 to-indigo-400";
}

export function getSeasonalBg(): string {
  return `bg-gradient-to-br ${getSeasonalGradient()}`;
}

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
