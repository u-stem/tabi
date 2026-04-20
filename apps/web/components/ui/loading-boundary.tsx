"use client";

import { useIsRestoring } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { cn } from "@/lib/utils";

interface LoadingBoundaryProps {
  isLoading: boolean;
  skeleton: ReactNode;
  error?: Error | null;
  errorFallback?: ReactNode;
  children: ReactNode;
  // Forwarded to the wrapper div around children — use when the parent
  // is a flex/grid container and the wrapper needs specific sizing (e.g. "h-full").
  className?: string;
  delay?: number;
}

export function LoadingBoundary({
  isLoading,
  skeleton,
  error,
  errorFallback,
  children,
  className,
  delay = 200,
}: LoadingBoundaryProps) {
  // While PersistQueryClientProvider hydrates from IndexedDB, useQuery reports
  // isLoading=false with data=undefined — callers that render an error fallback
  // on "!data" would flash it on every reload. Treat restoring as loading so
  // the skeleton covers that window.
  const isRestoring = useIsRestoring();
  const effectiveLoading = isLoading || isRestoring;
  const showSkeleton = useDelayedLoading(effectiveLoading, delay);

  if (effectiveLoading && !showSkeleton) return null;
  if (showSkeleton) return <>{skeleton}</>;
  if (error) return errorFallback ?? null;

  return <div className={cn("animate-in fade-in duration-150", className)}>{children}</div>;
}
