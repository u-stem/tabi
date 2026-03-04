"use client";

import type { FriendRequestResponse, NotificationsResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { Bell, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { isGuestUser } from "@/lib/guest";
import { useScrollDirection } from "@/lib/hooks/use-scroll-direction";
import { SP_NAV_LINKS } from "@/lib/nav-links";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

export function SpBottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const navHidden = useScrollDirection();

  useEffect(() => setMounted(true), []);

  const isGuest = isGuestUser(session);

  const { data: friendRequests } = useQuery({
    queryKey: queryKeys.friends.requests(),
    queryFn: () => api<FriendRequestResponse[]>("/api/friends/requests"),
    enabled: !!session?.user && !isGuest,
    refetchInterval: 60_000,
    retry: false,
  });
  const friendRequestCount = friendRequests?.length ?? 0;

  const { data: notifications } = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => api<NotificationsResponse>("/api/notifications"),
    enabled: !!session?.user && !isGuest,
    refetchInterval: 60_000,
    retry: false,
  });
  const unreadCount = notifications?.unreadCount ?? 0;

  const friendHref = "/sp/friends";
  const bookmarkHref = "/sp/bookmarks";
  const visibleLinks = SP_NAV_LINKS.filter(
    (link) => !isGuest || (link.href !== bookmarkHref && link.href !== friendHref),
  );

  return (
    <nav
      aria-label="ボトムナビゲーション"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 select-none border-t bg-background print:hidden transition-transform duration-300",
        navHidden && "translate-y-full",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-16 items-stretch">
        {visibleLinks.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 transition-[colors,transform] active:bg-accent active:scale-[0.90]",
                active ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <link.icon className="h-6 w-6" />
              <span className="text-[10px] leading-none">{link.label}</span>
              {link.href === friendHref && friendRequestCount > 0 && (
                <span className="absolute top-2 left-1/2 ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium tabular-nums text-destructive-foreground">
                  {friendRequestCount}
                </span>
              )}
            </Link>
          );
        })}
        {/* Notification tab: shown only for authenticated non-guest users */}
        {mounted && session?.user && !isGuest && (
          <Link
            href="/sp/notifications"
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 transition-[colors,transform] active:bg-accent active:scale-[0.90]",
              pathname === "/sp/notifications"
                ? "font-medium text-primary"
                : "text-muted-foreground",
            )}
            aria-label="通知"
          >
            <Bell className="h-6 w-6" />
            <span className="text-[10px] leading-none">通知</span>
            {unreadCount > 0 && (
              <span className="absolute top-2 left-1/2 ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium tabular-nums text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        )}
        {/* Account tab: always rendered to keep layout stable, content conditional on session */}
        <Link
          href="/sp/my"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 transition-[colors,transform] active:bg-accent active:scale-[0.90]",
            pathname === "/sp/my" ? "font-medium text-primary" : "text-muted-foreground",
          )}
          aria-label="プロフィール"
        >
          {mounted && session?.user ? (
            <UserAvatar
              name={session.user.name ?? ""}
              image={session.user.image}
              className="h-6 w-6"
            />
          ) : (
            <User className="h-6 w-6" />
          )}
          <span className="text-[10px] leading-none">プロフィール</span>
        </Link>
      </div>
    </nav>
  );
}
