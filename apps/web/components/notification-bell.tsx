"use client";

import {
  formatNotificationText,
  type Notification,
  type NotificationsResponse,
} from "@sugara/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { MSG } from "../lib/messages";
import { queryKeys } from "../lib/query-keys";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

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

  const unreadCount = data?.unreadCount ?? 0;

  async function handleClickNotification(n: Notification) {
    if (!n.readAt) {
      markRead.mutate(n.id);
    }
    setOpen(false);
    if (n.tripId) router.push(`/trips/${n.tripId}`);
  }

  return (
    <TooltipProvider>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Bell className="h-5 w-5 transition-transform duration-200 group-hover:rotate-12" />
                {unreadCount > 0 && (
                  <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>通知</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-80">
          {unreadCount > 0 && (
            <>
              <div className="flex justify-end px-3 py-2">
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  すべて既読
                </button>
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          {!data?.notifications.length ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              {MSG.EMPTY_NOTIFICATION}
            </div>
          ) : (
            data.notifications.map((n: Notification) => (
              <DropdownMenuItem
                key={n.id}
                className={`flex cursor-pointer flex-col items-start gap-0.5 px-3 py-2 ${!n.readAt ? "bg-muted/50" : ""}`}
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
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
