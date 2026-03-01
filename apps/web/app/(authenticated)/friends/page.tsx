"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FriendRequestsCard } from "@/components/friend-requests-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { copyToClipboard } from "@/lib/clipboard";
import { pageTitle } from "@/lib/constants";
import { isGuestUser } from "@/lib/guest";
import { useFriendsPage } from "@/lib/hooks/use-friends-page";
import { MSG } from "@/lib/messages";
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
      <UserIdSection userId={session?.user.id ?? ""} />
      <FriendRequestsCard requests={requests} />
      <FriendsTab friends={friends} />
      <GroupsTab groups={groups} />
      <SendRequestSection />
    </div>
  );
}

function UserIdSection({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyToClipboard(userId);
    setCopied(true);
    toast.success(MSG.SETTINGS_USER_ID_COPIED);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>あなたのユーザーID</CardTitle>
        <CardDescription>フレンド申請やメンバー追加時にこのIDを共有してください</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
            {userId}
          </code>
          <Button variant="outline" size="icon" onClick={handleCopy} aria-label="コピー">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
