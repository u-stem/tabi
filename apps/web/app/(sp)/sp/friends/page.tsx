"use client";

import { useQueryClient } from "@tanstack/react-query";
import { UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FriendsTab } from "@/app/(authenticated)/friends/_components/friends-tab";
import { GroupsTab } from "@/app/(authenticated)/friends/_components/groups-tab";
import { Fab } from "@/components/fab";
import { FriendRequestsCard } from "@/components/friend-requests-card";
import { SpSwipeTabs, type SwipeTab } from "@/components/sp-swipe-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { SkeletonBone, SkeletonGroup } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { isGuestUser } from "@/lib/guest";
import { useFriendsPage } from "@/lib/hooks/use-friends-page";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type Tab = "friends" | "groups";

const FRIEND_TABS: SwipeTab<Tab>[] = [
  { id: "friends", label: "フレンド" },
  { id: "groups", label: "グループ" },
];

function SpFriendsSkeleton() {
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

export default function SpFriendsPage() {
  const { data: session } = useSession();
  const isGuest = isGuestUser(session);
  const queryClient = useQueryClient();
  const { friends, requests, groups, isLoading } = useFriendsPage(isGuest);

  const [tab, setTab] = useState<Tab>("friends");
  const [sendOpen, setSendOpen] = useState(false);
  const [addresseeId, setAddresseeId] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [groupsCreateOpen, setGroupsCreateOpen] = useState(false);

  useEffect(() => {
    document.title = pageTitle("フレンド");
  }, []);

  const changeTab = useCallback((t: Tab) => {
    setTab(t);
  }, []);

  async function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = addresseeId.trim();
    if (!trimmed) return;
    setSendLoading(true);
    try {
      await api("/api/friends/requests", {
        method: "POST",
        body: JSON.stringify({ addresseeId: trimmed }),
      });
      toast.success(MSG.FRIEND_REQUEST_SENT);
      setAddresseeId("");
      setSendOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.FRIEND_REQUEST_SEND_FAILED));
    } finally {
      setSendLoading(false);
    }
  }

  const renderContent = useCallback(
    (t: Tab) => {
      switch (t) {
        case "friends":
          return (
            <div className="space-y-4">
              <FriendRequestsCard requests={requests} profileHrefPrefix="/sp/users" />
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
    [requests, friends, groups, groupsCreateOpen, setGroupsCreateOpen],
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
      <Fab onClick={() => setSendOpen(true)} label="フレンド申請" hidden={tab !== "friends"} />
      <Fab
        onClick={() => setGroupsCreateOpen(true)}
        label="グループを作成"
        hidden={tab !== "groups"}
      />

      {/* Send request dialog */}
      <ResponsiveDialog
        open={sendOpen}
        onOpenChange={(v) => {
          if (!v) {
            setSendOpen(false);
            setAddresseeId("");
          }
        }}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>フレンド申請</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              申請したいユーザーのIDを入力してください。ユーザーIDは相手のプロフィールページで確認できます。
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <form onSubmit={handleSendRequest}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="sp-addresseeId">ユーザーID</Label>
                <Input
                  id="sp-addresseeId"
                  value={addresseeId}
                  onChange={(e) => setAddresseeId(e.target.value)}
                  placeholder="550e8400-e29b-41d4-..."
                  required
                />
              </div>
            </div>
            <ResponsiveDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSendOpen(false);
                  setAddresseeId("");
                }}
              >
                <X className="h-4 w-4" />
                キャンセル
              </Button>
              <Button type="submit" disabled={sendLoading || !addresseeId.trim()}>
                <UserPlus className="h-4 w-4" />
                {sendLoading ? "送信中..." : "申請"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
