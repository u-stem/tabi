import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer relative overflow-hidden rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/**
 * Skeleton without its own shimmer — used inside SkeletonGroup.
 * The parent SkeletonGroup provides the unified shimmer effect.
 */
function SkeletonBone({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md bg-muted", className)} {...props} />;
}

/** Wrapper that provides a single unified shimmer across all child SkeletonBone elements. */
function SkeletonGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton-shimmer relative overflow-hidden", className)} {...props} />;
}

export { Skeleton, SkeletonBone, SkeletonGroup };
