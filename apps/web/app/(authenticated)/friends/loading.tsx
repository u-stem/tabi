import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkeletonBone, SkeletonGroup } from "@/components/ui/skeleton";

export default function FriendsLoading() {
  return (
    <SkeletonGroup className="mt-4 mx-auto max-w-2xl space-y-8">
      <Card>
        <CardHeader>
          <SkeletonBone className="h-6 w-24" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2">
            <SkeletonBone className="h-4 w-48" />
            <SkeletonBone className="h-8 w-16" />
          </div>
        </CardContent>
      </Card>
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <SkeletonBone className="h-6 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2].map((j) => (
              <div key={j} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SkeletonBone className="h-6 w-6 shrink-0 rounded-full" />
                  <SkeletonBone className="h-4 w-24" />
                </div>
                <div className="flex gap-2 shrink-0">
                  <SkeletonBone className="h-8 w-20" />
                  <SkeletonBone className="h-8 w-14" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </SkeletonGroup>
  );
}
