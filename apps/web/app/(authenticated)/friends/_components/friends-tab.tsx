"use client";

import type { FriendResponse } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

export { SendRequestSection };

export function FriendsTab() {
  const queryClient = useQueryClient();

  const { data: friends = [], isLoading } = useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => api<FriendResponse[]>("/api/friends"),
  });

  const showSkeleton = useDelayedLoading(isLoading);

  if (isLoading && !showSkeleton) return <div />;

  if (showSkeleton) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-14" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <FriendListSection
      friends={friends}
      onRemoved={() => queryClient.invalidateQueries({ queryKey: queryKeys.friends.list() })}
    />
  );
}

function FriendListSection({
  friends,
  onRemoved,
}: {
  friends: FriendResponse[];
  onRemoved: () => void;
}) {
  const [removingFriend, setRemovingFriend] = useState<FriendResponse | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleRemove(friendId: string) {
    setLoadingId(friendId);
    try {
      await api(`/api/friends/${friendId}`, { method: "DELETE" });
      toast.success(MSG.FRIEND_REMOVED);
      onRemoved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MSG.FRIEND_REMOVE_FAILED);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>フレンド一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {friends.length === 0 ? (
            <p className="text-sm text-muted-foreground">フレンドがいません</p>
          ) : (
            <div className="max-h-80 space-y-3 overflow-y-auto">
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
                      <Link href={`/users/${friend.userId}`}>プロフィール</Link>
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
      <AlertDialog
        open={removingFriend !== null}
        onOpenChange={(v) => !v && setRemovingFriend(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>フレンドを解除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{removingFriend?.name}
              」をフレンドから解除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removingFriend) handleRemove(removingFriend.friendId);
                setRemovingFriend(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              解除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      toast.error(err instanceof Error ? err.message : MSG.FRIEND_REQUEST_SEND_FAILED);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
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
