"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { FriendRequestsCard } from "@/components/friend-requests-card";
import { SentRequestsCard } from "@/components/sent-requests-card";
import type { ShortcutGroup } from "@/components/shortcut-help-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { isGuestUser } from "@/lib/guest";
import { useFriendsPage } from "@/lib/hooks/use-friends-page";
import { isDialogOpen } from "@/lib/hotkeys";
import { MSG } from "@/lib/messages";
import { useRegisterShortcuts, useShortcutHelp } from "@/lib/shortcut-help-context";
import { FriendsTab } from "./_components/friends-tab";
import { GroupsTab } from "./_components/groups-tab";
import { SendRequestSection } from "./_components/send-request-section";

const QrScannerDialog = dynamic(
  () =>
    import("@/components/qr-scanner-dialog").then((m) => ({
      default: m.QrScannerDialog,
    })),
  { ssr: false },
);

function FriendsSkeleton() {
  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-8">
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
  const { friends, requests, sentRequests, groups, isLoading } = useFriendsPage(isGuest);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const idInputRef = useRef<HTMLInputElement>(null);

  const searchParams = useSearchParams();
  const [addUserId, setAddUserId] = useState<string | null>(null);
  useEffect(() => {
    const uid = searchParams.get("addUserId");
    if (uid) setAddUserId(uid);
  }, [searchParams]);
  const handleInitialUserIdConsumed = useCallback(() => setAddUserId(null), []);

  const { open: openShortcutHelp } = useShortcutHelp();
  const shortcuts: ShortcutGroup[] = useMemo(
    () => [
      {
        group: "全般",
        items: [
          { key: "a", description: "フレンド追加" },
          { key: "n", description: "グループ新規作成" },
        ],
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
    "a",
    () => {
      if (!isDialogOpen()) idInputRef.current?.focus();
    },
    { preventDefault: true },
  );
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
        <Card className="border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader>
            <CardTitle>フレンド追加</CardTitle>
          </CardHeader>
          <CardContent>
            <SendRequestSection
              inputRef={idInputRef}
              trailing={
                <QrScannerDialog
                  initialUserId={addUserId}
                  onInitialUserIdConsumed={handleInitialUserIdConsumed}
                />
              }
            />
          </CardContent>
        </Card>
        <FriendRequestsCard requests={requests} />
        <SentRequestsCard sentRequests={sentRequests} />
        <FriendsTab friends={friends} />
        <GroupsTab
          groups={groups}
          createOpen={createGroupOpen}
          onCreateOpenChange={setCreateGroupOpen}
        />
      </div>
    </LoadingBoundary>
  );
}
