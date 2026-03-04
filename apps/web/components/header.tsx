"use client";

import type { FriendRequestResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { Settings, Smartphone } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { GuestBanner } from "@/components/guest-banner";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { isGuestUser } from "@/lib/guest";
import { usePushSubscription } from "@/lib/hooks/use-push-subscription";
import { NAV_LINKS } from "@/lib/nav-links";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { switchViewMode } from "@/lib/view-mode";

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isGuest = isGuestUser(session);
  usePushSubscription(!!session?.user && !isGuest);
  const visibleNavLinks = NAV_LINKS.filter(
    (link) => !isGuest || (link.href !== "/bookmarks" && link.href !== "/friends"),
  );
  // Prevent hydration mismatch: better-auth may return cached session synchronously
  // on the client while the server always starts with null.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: friendRequests } = useQuery({
    queryKey: queryKeys.friends.requests(),
    queryFn: () => api<FriendRequestResponse[]>("/api/friends/requests"),
    enabled: !!session?.user && !isGuestUser(session),
    refetchInterval: 60_000,
    // Cookie cache may return session without isAnonymous, causing a 403 before fresh session arrives
    retry: false,
  });
  const friendRequestCount = friendRequests?.length ?? 0;

  return (
    <header className="sticky top-0 z-30 select-none border-b bg-background">
      <AnnouncementBanner />
      <OfflineBanner />
      <GuestBanner />
      <nav
        aria-label="メインナビゲーション"
        className="container flex h-14 items-center justify-between"
      >
        <div className="flex items-center gap-6">
          <Logo href="/home" />
          {visibleNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "hidden md:inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors",
                pathname === link.href
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
              {link.href === "/friends" && friendRequestCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-xs font-medium tabular-nums text-destructive-foreground">
                  {friendRequestCount}
                </span>
              )}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {mounted && session?.user && !isGuest && <NotificationBell />}
          {!/\/(print|export)(\/|$)/.test(pathname) && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="SP版で表示"
              onClick={() => void switchViewMode("sp")}
            >
              <Smartphone className="h-6 w-6" />
            </Button>
          )}
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="設定" asChild>
            <Link href="/settings">
              <Settings className="h-6 w-6" />
            </Link>
          </Button>
          {!mounted || !session?.user || isGuest ? (
            <Skeleton className="h-8 w-8 rounded-full" />
          ) : (
            <Link href="/my" aria-label="マイページ">
              <UserAvatar
                name={session.user.name ?? ""}
                image={session.user.image}
                className="h-8 w-8"
              />
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
