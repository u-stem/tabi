import { SkeletonBone, SkeletonGroup } from "@/components/ui/skeleton";

export default function SpFriendsLoading() {
  return (
    <SkeletonGroup className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <SkeletonBone className="h-9 rounded-md" />
        <SkeletonBone className="h-9 rounded-md" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <SkeletonBone className="h-10 w-10 shrink-0 rounded-full" />
          <SkeletonBone className="h-4 w-28" />
        </div>
      ))}
    </SkeletonGroup>
  );
}
