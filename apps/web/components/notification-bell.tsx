"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type Notification = {
  id: string;
  type: string;
  payload: Record<string, string>;
  readAt: string | null;
  createdAt: string;
  tripId: string | null;
};

type NotificationsResponse = {
  notifications: Notification[];
  unreadCount: number;
};

function fetcher(url: string) {
  return api<NotificationsResponse>(url);
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data, mutate } = useSWR("/api/notifications", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });

  const unreadCount = data?.unreadCount ?? 0;

  async function handleMarkAllRead() {
    await api("/api/notifications/read-all", { method: "PUT" });
    await mutate();
  }

  async function handleClickNotification(n: Notification) {
    if (!n.readAt) {
      await api(`/api/notifications/${n.id}/read`, { method: "PUT" });
      await mutate();
    }
    setOpen(false);
    if (n.tripId) router.push(`/trips/${n.tripId}`);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">通知</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              すべて既読
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {!data?.notifications.length ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            通知はありません
          </div>
        ) : (
          data.notifications.map((n: Notification) => (
            <DropdownMenuItem
              key={n.id}
              className={`flex cursor-pointer flex-col items-start gap-0.5 px-3 py-2 ${!n.readAt ? "bg-muted/50" : ""}`}
              onClick={() => handleClickNotification(n)}
            >
              <span className="text-sm">{formatNotificationText(n)}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatNotificationText(n: Notification): string {
  const p = n.payload;
  switch (n.type) {
    case "member_added":
      return `${p.actorName}さんが「${p.tripName}」に招待しました`;
    case "member_removed":
      return `「${p.tripName}」のメンバーから削除されました`;
    case "role_changed":
      return `「${p.tripName}」でのロールが変更されました`;
    case "schedule_created":
      return `${p.actorName}さんが「${p.entityName}」を追加しました`;
    case "schedule_updated":
      return `${p.actorName}さんが「${p.entityName}」を更新しました`;
    case "schedule_deleted":
      return `${p.actorName}さんがスケジュールを削除しました`;
    case "poll_started":
      return `「${p.tripName}」で日程投票が開始されました`;
    case "poll_closed":
      return `「${p.tripName}」の日程投票が終了しました`;
    case "expense_added":
      return `${p.actorName}さんが経費「${p.entityName}」を追加しました`;
    default:
      return "新しい通知があります";
  }
}
