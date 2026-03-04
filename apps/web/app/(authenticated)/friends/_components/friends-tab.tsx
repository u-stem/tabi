"use client";

import type { FriendResponse } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogDestructiveAction,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { useMobile } from "@/lib/hooks/use-is-mobile";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

export { SendRequestSection };

export function FriendsTab({
  friends,
  profileHrefPrefix = "/users",
}: {
  friends: FriendResponse[];
  profileHrefPrefix?: string;
}) {
  const queryClient = useQueryClient();

  return (
    <FriendListSection
      friends={friends}
      profileHrefPrefix={profileHrefPrefix}
      onRemoved={() => queryClient.invalidateQueries({ queryKey: queryKeys.friends.list() })}
    />
  );
}

function FriendListSection({
  friends,
  profileHrefPrefix,
  onRemoved,
}: {
  friends: FriendResponse[];
  profileHrefPrefix: string;
  onRemoved: () => void;
}) {
  const queryClient = useQueryClient();
  const isMobile = useMobile();
  const [removingFriend, setRemovingFriend] = useState<FriendResponse | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleRemove(friendId: string) {
    setLoadingId(friendId);
    const cacheKey = queryKeys.friends.list();
    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<FriendResponse[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.filter((f) => f.friendId !== friendId),
      );
    }
    toast.success(MSG.FRIEND_REMOVED);

    try {
      await api(`/api/friends/${friendId}`, { method: "DELETE" });
      onRemoved();
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, MSG.FRIEND_REMOVE_FAILED));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <>
      <Card className="border-0 shadow-none sm:border sm:shadow-sm">
        {!isMobile && (
          <CardHeader>
            <CardTitle>フレンド一覧</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          {friends.length === 0 ? (
            <p className="text-sm text-muted-foreground">{MSG.EMPTY_FRIEND}</p>
          ) : (
            <div className={cn("space-y-3", !isMobile && "max-h-80 overflow-y-auto")}>
              {friends.map((friend) => (
                <div key={friend.friendId} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar
                      name={friend.name}
                      image={friend.image}
                      className="h-6 w-6 shrink-0"
                      fallbackClassName="text-xs"
                    />
                    <span className="text-sm truncate">{friend.name}</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`${profileHrefPrefix}/${friend.userId}`}>プロフィール</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingId === friend.friendId}
                      onClick={() => setRemovingFriend(friend)}
                    >
                      解除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <ResponsiveAlertDialog
        open={removingFriend !== null}
        onOpenChange={(v) => !v && setRemovingFriend(null)}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>フレンドを解除しますか？</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              「{removingFriend?.name}
              」をフレンドから解除します。この操作は取り消せません。
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>
              <X className="h-4 w-4" />
              キャンセル
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogDestructiveAction
              onClick={() => {
                if (removingFriend) handleRemove(removingFriend.friendId);
                setRemovingFriend(null);
              }}
            >
              解除する
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </>
  );
}

function SendRequestSection() {
  const queryClient = useQueryClient();
  const [addresseeId, setAddresseeId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = addresseeId.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      await api("/api/friends/requests", {
        method: "POST",
        body: JSON.stringify({ addresseeId: trimmed }),
      });
      toast.success(MSG.FRIEND_REQUEST_SENT);
      setAddresseeId("");
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.FRIEND_REQUEST_SEND_FAILED));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
      <form onSubmit={handleSubmit}>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>フレンド申請</CardTitle>
          <Button size="sm" type="submit" disabled={loading || !addresseeId.trim()}>
            <UserPlus className="mr-1 h-4 w-4" />
            {loading ? "送信中..." : "申請"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="addresseeId">ユーザーID</Label>
            <Input
              id="addresseeId"
              name="addresseeId"
              value={addresseeId}
              onChange={(e) => setAddresseeId(e.target.value)}
              placeholder="550e8400-e29b-41d4-..."
              required
            />
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
