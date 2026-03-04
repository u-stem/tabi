"use client";

import { useQueryClient } from "@tanstack/react-query";
import { UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FriendsTab } from "@/app/(authenticated)/friends/_components/friends-tab";
import { GroupsTab } from "@/app/(authenticated)/friends/_components/groups-tab";
import { Fab } from "@/components/fab";
import { FriendRequestsCard } from "@/components/friend-requests-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { isGuestUser } from "@/lib/guest";
import { useFriendsPage } from "@/lib/hooks/use-friends-page";
import { useSwipeTab } from "@/lib/hooks/use-swipe-tab";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

const TABS = ["friends", "groups"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  friends: "フレンド",
  groups: "グループ",
};

function PageSkeleton() {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <Skeleton className="h-9 rounded-md" />
        <Skeleton className="h-9 rounded-md" />
      </div>
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
  const queryClient = useQueryClient();
  const { friends, requests, groups, isLoading, showSkeleton } = useFriendsPage(isGuest);

  const [tab, setTab] = useState<Tab>("friends");
  const tabRef = useRef<Tab>("friends");
  const [sendOpen, setSendOpen] = useState(false);
  const [addresseeId, setAddresseeId] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [groupsCreateOpen, setGroupsCreateOpen] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = pageTitle("フレンド");
  }, []);

  const currentTabIdx = TABS.indexOf(tab);

  const changeTab = useCallback((t: Tab) => {
    tabRef.current = t;
    setTab(t);
  }, []);

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      const idx = TABS.indexOf(tabRef.current);
      const nextIdx = direction === "left" ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= TABS.length) return;
      changeTab(TABS[nextIdx]);
    },
    [changeTab],
  );

  const swipe = useSwipeTab(contentRef, swipeRef, {
    onSwipeComplete: handleSwipe,
    canSwipePrev: currentTabIdx > 0,
    canSwipeNext: currentTabIdx < TABS.length - 1,
    enabled: !isLoading && !showSkeleton && !isGuest,
  });

  const adjacentTab =
    swipe.adjacent === "next"
      ? TABS[currentTabIdx + 1]
      : swipe.adjacent === "prev"
        ? TABS[currentTabIdx - 1]
        : undefined;

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

  function renderTab(t: Tab) {
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
  }

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

  const tabItems = TABS.map((t, i) => ({ value: t, label: TAB_LABELS[t], index: i }));

  return (
    <>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
      >
        {tabItems.map(({ value, label, index }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => changeTab(value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                changeTab(tabItems[(index + 1) % tabItems.length].value);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                changeTab(tabItems[(index - 1 + tabItems.length) % tabItems.length].value);
              }
            }}
            className={cn(
              "min-h-[36px] rounded-md px-2 py-1.5 text-sm font-medium transition-[colors,transform] active:scale-[0.97]",
              tab === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Swipe container */}
      <div
        ref={contentRef}
        className="mt-4 min-h-[60vh] overflow-x-hidden px-0.5 -mx-0.5 touch-pan-y"
      >
        <div ref={swipeRef} className="relative touch-pan-y will-change-transform">
          <div className="pt-0.5">{renderTab(tab)}</div>

          {swipe.adjacent && adjacentTab && (
            <div
              className="absolute top-0 left-0 w-full pt-0.5"
              aria-hidden="true"
              style={{
                transform: swipe.adjacent === "next" ? "translateX(100%)" : "translateX(-100%)",
              }}
            >
              {renderTab(adjacentTab)}
            </div>
          )}
        </div>
      </div>

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
              申請したいユーザーのIDを入力してください
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
