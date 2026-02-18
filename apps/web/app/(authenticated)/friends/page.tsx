"use client";

import type { FriendRequestResponse, FriendResponse, GroupResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { FriendRequestsCard } from "@/components/friend-requests-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { pageTitle } from "@/lib/constants";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { queryKeys } from "@/lib/query-keys";
import { FriendsTab, SendRequestSection } from "./_components/friends-tab";
import { GroupsTab } from "./_components/groups-tab";

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

export default function FriendsPage() {
  useEffect(() => {
    document.title = pageTitle("フレンド");
  }, []);

  const friendsQuery = useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => api<FriendResponse[]>("/api/friends"),
  });

  const requestsQuery = useQuery({
    queryKey: queryKeys.friends.requests(),
    queryFn: () => api<FriendRequestResponse[]>("/api/friends/requests"),
  });

  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: () => api<GroupResponse[]>("/api/groups"),
  });

  const isLoading = friendsQuery.isLoading || requestsQuery.isLoading || groupsQuery.isLoading;
  const showSkeleton = useDelayedLoading(isLoading);

  if (isLoading && !showSkeleton) return <PageSkeleton />;
  if (showSkeleton) return <PageSkeleton />;

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-8">
      <FriendRequestsCard requests={requestsQuery.data ?? []} />
      <FriendsTab friends={friendsQuery.data ?? []} />
      <GroupsTab groups={groupsQuery.data ?? []} />
      <SendRequestSection />
    </div>
  );
}
