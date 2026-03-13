"use client";

import type { FriendRequestResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { GuestBanner } from "@/components/guest-banner";
import { HeaderMenu } from "@/components/header-menu";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { OfflineBanner } from "@/components/offline-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { isGuestUser } from "@/lib/guest";
import { usePushSubscription } from "@/lib/hooks/use-push-subscription";
import { NAV_LINKS } from "@/lib/nav-links";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

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
        <TooltipProvider>
          <div className="flex items-center gap-2">
            <HeaderMenu />
            {mounted && session?.user && !isGuest && <NotificationBell />}
            {!mounted || !session?.user ? (
              <Skeleton className="h-8 w-8 rounded-full" />
            ) : isGuest ? (
              <UserAvatar name="G" className="h-8 w-8" />
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/my"
                    aria-label="マイページ"
                    className="group flex h-9 w-9 items-center justify-center"
                  >
                    <UserAvatar
                      name={session.user.name ?? ""}
                      image={session.user.image}
                      className="h-8 w-8 transition-transform duration-200 group-hover:scale-110"
                    />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>マイページ</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </nav>
    </header>
  );
}
