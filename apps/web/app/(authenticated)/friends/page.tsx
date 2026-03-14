"use client";

import { useEffect } from "react";
import { FriendRequestsCard } from "@/components/friend-requests-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { SkeletonBone, SkeletonGroup } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { isGuestUser } from "@/lib/guest";
import { useFriendsPage } from "@/lib/hooks/use-friends-page";
import { MSG } from "@/lib/messages";
import { FriendsTab, SendRequestSection } from "./_components/friends-tab";
import { GroupsTab } from "./_components/groups-tab";

function FriendsSkeleton() {
  return (
    <SkeletonGroup className="mt-4 mx-auto max-w-2xl space-y-8">
      {/* UserIdSection */}
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
      {/* FriendsTab / GroupsTab */}
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

export default function FriendsPage() {
  const { data: session } = useSession();
  const isGuest = isGuestUser(session);
  const { friends, requests, groups, isLoading } = useFriendsPage(isGuest);

  useEffect(() => {
    document.title = pageTitle("フレンド");
  }, []);

  if (isGuest) {
    return (
      <div className="mt-4 mx-auto max-w-2xl">
        <div className="rounded-lg border bg-muted/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">{MSG.AUTH_GUEST_FEATURE_UNAVAILABLE}</p>
        </div>
      </div>
    );
  }

  return (
    <LoadingBoundary isLoading={isLoading} skeleton={<FriendsSkeleton />}>
      <div className="mt-4 mx-auto max-w-2xl space-y-8">
        <FriendRequestsCard requests={requests} />
        <FriendsTab friends={friends} />
        <GroupsTab groups={groups} />
        <SendRequestSection />
      </div>
    </LoadingBoundary>
  );
}
