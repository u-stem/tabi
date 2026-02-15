"use client";

import type { FriendRequestResponse, FriendResponse } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { useDelayedLoading } from "@/lib/use-delayed-loading";

export default function FriendsPage() {
  const queryClient = useQueryClient();

  const { data: friends = [], isLoading: friendsLoading } = useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => api<FriendResponse[]>("/api/friends"),
  });

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: queryKeys.friends.requests(),
    queryFn: () => api<FriendRequestResponse[]>("/api/friends/requests"),
  });

  const loading = friendsLoading || requestsLoading;
  const showSkeleton = useDelayedLoading(loading);

  useEffect(() => {
    document.title = "フレンド - sugara";
  }, []);

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });

  if (loading && !showSkeleton) return <div />;

  if (showSkeleton) {
    return (
      <div className="mt-4 mx-auto max-w-2xl space-y-8">
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
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-28" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-16" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-8">
      {requests.length > 0 && <RequestsSection requests={requests} onUpdate={invalidateAll} />}
      <FriendListSection
        friends={friends}
        onRemoved={() => queryClient.invalidateQueries({ queryKey: queryKeys.friends.list() })}
      />
      <SendRequestSection
        onSent={() => queryClient.invalidateQueries({ queryKey: queryKeys.friends.requests() })}
      />
    </div>
  );
}

function RequestsSection({
  requests,
  onUpdate,
}: {
  requests: FriendRequestResponse[];
  onUpdate: () => void;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleAccept(id: string) {
    setLoadingId(id);
    try {
      await api(`/api/friends/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "accepted" }),
      });
      toast.success(MSG.FRIEND_REQUEST_ACCEPTED);
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MSG.FRIEND_REQUEST_ACCEPT_FAILED);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(id: string) {
    setLoadingId(id);
    try {
      await api(`/api/friends/requests/${id}`, { method: "DELETE" });
      toast.success(MSG.FRIEND_REQUEST_REJECTED);
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MSG.FRIEND_REQUEST_REJECT_FAILED);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>受信リクエスト</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((req) => (
          <div key={req.id} className="flex items-center justify-between gap-2">
            <span className="text-sm truncate">{req.name}</span>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                disabled={loadingId === req.id}
                onClick={() => handleAccept(req.id)}
              >
                承認
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loadingId === req.id}
                onClick={() => handleReject(req.id)}
              >
                拒否
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
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
            <div className="space-y-3">
              {friends.map((friend) => (
                <div key={friend.friendId} className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">{friend.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loadingId === friend.friendId}
                    onClick={() => setRemovingFriend(friend)}
                  >
                    解除
                  </Button>
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

function SendRequestSection({ onSent }: { onSent: () => void }) {
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
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MSG.FRIEND_REQUEST_SEND_FAILED);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>フレンド申請</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <Button type="submit" disabled={loading || !addresseeId.trim()}>
            {loading ? "送信中..." : "申請"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
