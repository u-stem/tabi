"use client";

import {
  formatNotificationText,
  type Notification,
  type NotificationsResponse,
} from "@sugara/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { pageTitle } from "@/lib/constants";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

export default function SpNotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => api<NotificationsResponse>("/api/notifications"),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const markAllRead = useMutation({
    mutationFn: () => api("/api/notifications/read-all", { method: "PUT" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() }),
    onError: () => toast.error(MSG.NOTIFICATION_MARK_ALL_READ_FAILED),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/api/notifications/${id}/read`, { method: "PUT" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() }),
    onError: () => toast.error(MSG.NOTIFICATION_MARK_READ_FAILED),
  });

  useEffect(() => {
    document.title = pageTitle("通知");
  }, []);

  const unreadCount = data?.unreadCount ?? 0;

  function handleClickNotification(n: Notification) {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.tripId) router.push(`/sp/trips/${n.tripId}`);
  }

  return (
    <div className="mt-4 mx-auto max-w-2xl">
      {unreadCount > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            すべて既読
          </button>
        </div>
      )}
      {!data?.notifications.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{MSG.EMPTY_NOTIFICATION}</p>
      ) : (
        <div className="divide-y overflow-hidden rounded-lg border">
          {data.notifications.map((n: Notification) => (
            <button
              key={n.id}
              type="button"
              className={`flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-accent/50 ${!n.readAt ? "bg-muted/50" : ""}`}
              onClick={() => handleClickNotification(n)}
            >
              <span className="text-sm">{formatNotificationText(n.type, n.payload)}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
