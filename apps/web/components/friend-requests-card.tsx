"use client";

import type { FriendRequestResponse } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { SwipeableCard } from "@/components/swipeable-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

export function FriendRequestsCard({ requests }: { requests?: FriendRequestResponse[] }) {
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const { data: fetched = [] } = useQuery({
    queryKey: queryKeys.friends.requests(),
    queryFn: () => api<FriendRequestResponse[]>("/api/friends/requests"),
    enabled: requests === undefined,
  });

  const resolved = requests ?? fetched;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
  };

  async function handleAccept(id: string) {
    setLoadingId(id);
    const cacheKey = queryKeys.friends.requests();
    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<FriendRequestResponse[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.filter((r) => r.id !== id),
      );
    }
    toast.success(MSG.FRIEND_REQUEST_ACCEPTED);

    try {
      await api(`/api/friends/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "accepted" }),
      });
      invalidate();
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, MSG.FRIEND_REQUEST_ACCEPT_FAILED));
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(id: string) {
    setLoadingId(id);
    const cacheKey = queryKeys.friends.requests();
    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<FriendRequestResponse[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.filter((r) => r.id !== id),
      );
    }
    toast.success(MSG.FRIEND_REQUEST_REJECTED);

    try {
      await api(`/api/friends/requests/${id}`, { method: "DELETE" });
      invalidate();
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, MSG.FRIEND_REQUEST_REJECT_FAILED));
    } finally {
      setLoadingId(null);
    }
  }

  if (resolved.length === 0) return null;

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader>
        <CardTitle>フレンドリクエスト</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {resolved.map((req) =>
          isMobile ? (
            <SwipeableCard
              key={req.id}
              disabled={loadingId === req.id}
              actions={[
                {
                  label: "承認",
                  icon: <Check className="h-4 w-4" />,
                  color: "green" as const,
                  onClick: () => handleAccept(req.id),
                },
                {
                  label: "拒否",
                  icon: <X className="h-4 w-4" />,
                  color: "red" as const,
                  onClick: () => handleReject(req.id),
                },
              ]}
            >
              <Link
                href={`/users/${req.requesterId}`}
                className="flex items-center gap-2 min-w-0 rounded-lg border bg-card px-3 py-2"
              >
                <UserAvatar
                  name={req.name}
                  image={req.image}
                  className="h-6 w-6 shrink-0"
                  fallbackClassName="text-xs"
                />
                <span className="text-sm truncate">{req.name}</span>
              </Link>
            </SwipeableCard>
          ) : (
            <div key={req.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar
                  name={req.name}
                  image={req.image}
                  className="h-6 w-6 shrink-0"
                  fallbackClassName="text-xs"
                />
                <span className="text-sm truncate">{req.name}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/users/${req.requesterId}`}>プロフィール</Link>
                </Button>
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
          ),
        )}
      </CardContent>
    </Card>
  );
}
