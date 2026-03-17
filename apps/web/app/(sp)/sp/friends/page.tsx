"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ScanLine } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FriendsTab } from "@/app/(authenticated)/friends/_components/friends-tab";
import { GroupsTab } from "@/app/(authenticated)/friends/_components/groups-tab";
import { SendRequestSection } from "@/app/(authenticated)/friends/_components/send-request-section";
import { Fab } from "@/components/fab";
import { FriendRequestsCard } from "@/components/friend-requests-card";
import { SentRequestsCard } from "@/components/sent-requests-card";
import { SpSwipeTabs, type SwipeTab } from "@/components/sp-swipe-tabs";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { isGuestUser } from "@/lib/guest";
import { useFriendsPage } from "@/lib/hooks/use-friends-page";
import { useFriendsSync } from "@/lib/hooks/use-friends-sync";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

const QrScannerDialog = dynamic(
  () =>
    import("@/components/qr-scanner-dialog").then((m) => ({
      default: m.QrScannerDialog,
    })),
  { ssr: false },
);

type Tab = "friends" | "groups";

const FRIEND_TABS: SwipeTab<Tab>[] = [
  { id: "friends", label: "フレンド" },
  { id: "groups", label: "グループ" },
];

function SpFriendsSkeleton() {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <Skeleton className="h-9 rounded-md" />
        <Skeleton className="h-9 rounded-md" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

export default function SpFriendsPage() {
  const { data: session } = useSession();
  const isGuest = isGuestUser(session);
  const { friends, requests, sentRequests, groups, isLoading } = useFriendsPage(isGuest);
  const queryClient = useQueryClient();
  useFriendsSync(session?.user?.id, () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.friends.all }),
  );

  const [tab, setTab] = useState<Tab>("friends");
  const [groupsCreateOpen, setGroupsCreateOpen] = useState(false);

  const searchParams = useSearchParams();
  const [addUserId, setAddUserId] = useState<string | null>(null);
  useEffect(() => {
    const uid = searchParams.get("addUserId");
    if (uid) setAddUserId(uid);
  }, [searchParams]);
  const handleInitialUserIdConsumed = useCallback(() => setAddUserId(null), []);

  useEffect(() => {
    document.title = pageTitle("フレンド");
  }, []);

  const changeTab = useCallback((t: Tab) => {
    setTab(t);
  }, []);

  const renderContent = useCallback(
    (t: Tab) => {
      switch (t) {
        case "friends":
          return (
            <div className="space-y-4">
              <SendRequestSection />
              <FriendRequestsCard requests={requests} profileHrefPrefix="/sp/users" />
              <SentRequestsCard sentRequests={sentRequests} profileHrefPrefix="/sp/users" />
              <FriendsTab friends={friends} profileHrefPrefix="/sp/users" />
            </div>
          );
        case "groups":
          return (
            <GroupsTab
              groups={groups}
              createOpen={groupsCreateOpen}
              onCreateOpenChange={setGroupsCreateOpen}
            />
          );
      }
    },
    [requests, sentRequests, friends, groups, groupsCreateOpen, setGroupsCreateOpen],
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
    <>
      <LoadingBoundary isLoading={isLoading} skeleton={<SpFriendsSkeleton />}>
        <SpSwipeTabs<Tab>
          tabs={FRIEND_TABS}
          activeTab={tab}
          onTabChange={changeTab}
          renderContent={renderContent}
          swipeEnabled={!isLoading && !isGuest}
          className="mt-4"
        />
      </LoadingBoundary>

      {/* FABs are rendered outside the swipe container to avoid will-change-transform breaking fixed positioning */}
      <Fab
        onClick={() => setGroupsCreateOpen(true)}
        label="グループを作成"
        hidden={tab !== "groups"}
      />
      <QrScannerDialog
        initialUserId={addUserId}
        onInitialUserIdConsumed={handleInitialUserIdConsumed}
        trigger={
          <Fab label="QR読み取り" hidden={tab !== "friends"}>
            <ScanLine className="h-6 w-6" />
          </Fab>
        }
      />
    </>
  );
}
