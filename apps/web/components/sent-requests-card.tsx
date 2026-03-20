"use client";

import type { SentFriendRequestResponse } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { broadcastFriendsUpdate } from "@/lib/hooks/use-friends-sync";
import { useMobile } from "@/lib/hooks/use-is-mobile";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

export function SentRequestsCard({
  sentRequests,
  profileHrefPrefix = "/users",
}: {
  sentRequests?: SentFriendRequestResponse[];
  profileHrefPrefix?: string;
}) {
  const tm = useTranslations("messages");
  const tf = useTranslations("friend");
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data: fetched = [] } = useQuery({
    queryKey: queryKeys.friends.sentRequests(),
    queryFn: () => api<SentFriendRequestResponse[]>("/api/friends/requests/sent"),
    enabled: sentRequests === undefined,
    ...QUERY_CONFIG.stable,
  });

  const isMobile = useMobile();
  const resolved = sentRequests ?? fetched;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
  };

  async function handleCancel(id: string, addresseeId: string) {
    setLoadingId(id);
    const cacheKey = queryKeys.friends.sentRequests();
    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<SentFriendRequestResponse[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.filter((r) => r.id !== id),
      );
    }
    toast.success(tm("friendRequestCancelled"));

    try {
      await api(`/api/friends/requests/${id}`, { method: "DELETE" });
      invalidate();
      broadcastFriendsUpdate(addresseeId);
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, tm("friendRequestCancelFailed") as string));
    } finally {
      setLoadingId(null);
    }
  }

  if (resolved.length === 0) return null;

  if (isMobile) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">{tf("sentRequests")}</h3>
        </div>
        <div className="divide-y divide-border">
          {resolved.map((req) => (
            <div key={req.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`${profileHrefPrefix}/${req.addresseeId}`} className="shrink-0">
                <UserAvatar name={req.name} image={req.image} className="h-10 w-10" />
              </Link>
              <Link href={`${profileHrefPrefix}/${req.addresseeId}`} className="min-w-0 flex-1">
                <span className="truncate text-sm font-medium">{req.name}</span>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9"
                  disabled={loadingId === req.id}
                  onClick={() => handleCancel(req.id, req.addresseeId)}
                  aria-label={tf("cancel")}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader>
        <CardTitle>{tf("sentRequests")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {resolved.map((req) => (
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
                <Link href={`${profileHrefPrefix}/${req.addresseeId}`}>{tf("profile")}</Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loadingId === req.id}
                onClick={() => handleCancel(req.id, req.addresseeId)}
              >
                {tf("cancel")}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
