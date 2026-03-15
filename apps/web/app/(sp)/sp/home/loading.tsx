import { SkeletonBone, SkeletonGroup } from "@/components/ui/skeleton";

export default function SpHomeLoading() {
  return (
    <SkeletonGroup className="mt-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <SkeletonBone className="h-9 rounded-md" />
        <SkeletonBone className="h-9 rounded-md" />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <SkeletonBone className="h-10 w-full rounded-md" />
        <div className="flex gap-2">
          <SkeletonBone className="h-9 flex-1 rounded-md" />
          <SkeletonBone className="h-9 flex-1 rounded-md" />
          <SkeletonBone className="h-9 flex-1 rounded-md" />
        </div>
      </div>
      <div className="mt-4 grid gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border">
            <SkeletonBone className="aspect-[16/9] w-full rounded-none" />
            <div className="space-y-2 p-4">
              <SkeletonBone className="h-5 w-3/5" />
              <SkeletonBone className="h-4 w-2/5" />
              <SkeletonBone className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
