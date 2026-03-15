"use client";

import { useEffect, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { FriendRequestsCard } from "@/components/friend-requests-card";
import type { ShortcutGroup } from "@/components/shortcut-help-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { isGuestUser } from "@/lib/guest";
import { useFriendsPage } from "@/lib/hooks/use-friends-page";
import { isDialogOpen } from "@/lib/hotkeys";
import { MSG } from "@/lib/messages";
import { useRegisterShortcuts, useShortcutHelp } from "@/lib/shortcut-help-context";
import { FriendsTab, SendRequestSection } from "./_components/friends-tab";
import { GroupsTab } from "./_components/groups-tab";

function FriendsSkeleton() {
  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-8">
      {/* UserIdSection */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-16" />
          </div>
        </CardContent>
      </Card>
      {/* FriendsTab / GroupsTab */}
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2].map((j) => (
              <div key={j} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex gap-2 shrink-0">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-14" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function FriendsPage() {
  const { data: session } = useSession();
  const isGuest = isGuestUser(session);
  const { friends, requests, groups, isLoading } = useFriendsPage(isGuest);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);

  const { open: openShortcutHelp } = useShortcutHelp();
  const shortcuts: ShortcutGroup[] = useMemo(
    () => [
      {
        group: "全般",
        items: [{ key: "n", description: "グループ新規作成" }],
      },
    ],
    [],
  );
  useRegisterShortcuts(shortcuts);

  useEffect(() => {
    document.title = pageTitle("フレンド");
  }, []);

  useHotkeys("?", () => openShortcutHelp(), { useKey: true, preventDefault: true });
  useHotkeys(
    "n",
    () => {
      if (!isDialogOpen()) setCreateGroupOpen(true);
    },
    { preventDefault: true },
  );

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
        <GroupsTab
          groups={groups}
          createOpen={createGroupOpen}
          onCreateOpenChange={setCreateGroupOpen}
        />
        <SendRequestSection />
      </div>
    </LoadingBoundary>
  );
}
