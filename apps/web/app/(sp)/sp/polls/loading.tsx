import { SkeletonBone, SkeletonGroup } from "@/components/ui/skeleton";

export default function SpPollsLoading() {
  return (
    <SkeletonGroup className="mt-4 space-y-3">
      {["skeleton-1", "skeleton-2"].map((key) => (
        <div key={key} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <SkeletonBone className="h-5 w-40" />
              <SkeletonBone className="h-3 w-12" />
            </div>
            <SkeletonBone className="h-5 w-14 rounded-full" />
          </div>
          <div className="flex gap-1">
            <SkeletonBone className="h-8 w-20" />
            <SkeletonBone className="h-8 w-16" />
            <SkeletonBone className="h-8 w-16" />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}
