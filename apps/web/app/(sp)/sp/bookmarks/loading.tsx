import { SkeletonBone, SkeletonGroup } from "@/components/ui/skeleton";

export default function SpBookmarksLoading() {
  return (
    <SkeletonGroup className="mt-4">
      <div className="flex gap-2">
        <SkeletonBone className="h-9 flex-1 rounded-md" />
        <SkeletonBone className="h-9 flex-1 rounded-md" />
      </div>
      <div className="mt-4 grid gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <SkeletonBone className="h-5 w-32" />
              <SkeletonBone className="h-5 w-12 rounded-full" />
            </div>
            <SkeletonBone className="h-4 w-24" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
