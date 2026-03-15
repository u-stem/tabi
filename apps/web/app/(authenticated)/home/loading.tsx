import { SkeletonBone, SkeletonGroup } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <SkeletonGroup>
      <div className="mt-4 flex gap-1.5">
        <SkeletonBone className="h-8 w-24 rounded-full" />
        <SkeletonBone className="h-8 w-28 rounded-full" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <SkeletonBone className="h-8 w-full sm:w-40 sm:flex-none" />
        <SkeletonBone className="h-8 flex-1 sm:w-[120px] sm:flex-none" />
        <SkeletonBone className="h-8 flex-1 sm:w-20 sm:flex-none" />
        <SkeletonBone className="h-8 w-16 sm:ml-auto" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
          <div key={key} className="rounded-lg border bg-card shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6">
              <div className="flex items-center justify-between">
                <SkeletonBone className="h-5 w-32" />
                <SkeletonBone className="h-5 w-16 rounded-full" />
              </div>
              <SkeletonBone className="h-4 w-24" />
            </div>
            <div className="p-6 pt-0">
              <SkeletonBone className="h-4 w-40" />
              <SkeletonBone className="mt-1 h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
