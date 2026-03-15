import { Skeleton } from "@/components/ui/skeleton";

export default function PollsLoading() {
  return (
    <div>
      <div className="flex items-center justify-end">
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="mt-4 space-y-3">
        {["skeleton-1", "skeleton-2"].map((key) => (
          <div key={key} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <div className="flex gap-1">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
