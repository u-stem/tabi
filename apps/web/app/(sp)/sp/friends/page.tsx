"use client";

import { useEffect } from "react";
import {
  FriendsTab,
  SendRequestSection,
} from "@/app/(authenticated)/friends/_components/friends-tab";
import { GroupsTab } from "@/app/(authenticated)/friends/_components/groups-tab";
import { FriendRequestsCard } from "@/components/friend-requests-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { isGuestUser } from "@/lib/guest";
import { useFriendsPage } from "@/lib/hooks/use-friends-page";
import { MSG } from "@/lib/messages";

function PageSkeleton() {
  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-8">
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-14" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function SpFriendsPage() {
  const { data: session } = useSession();
  const isGuest = isGuestUser(session);
  const { friends, requests, groups, isLoading, showSkeleton } = useFriendsPage(isGuest);

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

  if (isLoading && !showSkeleton) return <div />;
  if (showSkeleton) return <PageSkeleton />;

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-8">
      <FriendRequestsCard requests={requests} profileHrefPrefix="/sp/users" />
      <FriendsTab friends={friends} profileHrefPrefix="/sp/users" />
      <GroupsTab groups={groups} />
      <SendRequestSection />
    </div>
  );
}
