"use client";

import type { FriendRequestResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { Settings, Smartphone } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { GuestBanner } from "@/components/guest-banner";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeToggle } from "@/components/theme-toggle";
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
import { switchViewMode } from "@/lib/view-mode";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
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
          <div className="flex items-center gap-1">
            {mounted && session?.user && !isGuest && <NotificationBell />}
            {!/\/(print|export)(\/|$)/.test(pathname) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="SP版で表示"
                    onClick={() => void switchViewMode("sp", (url) => router.push(url))}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <Smartphone className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>SP版で表示</TooltipContent>
              </Tooltip>
            )}
            <ThemeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/settings"
                  aria-label="設定"
                  className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Settings className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>設定</TooltipContent>
            </Tooltip>
            {!mounted || !session?.user || isGuest ? (
              <Skeleton className="h-8 w-8 rounded-full" />
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/my" aria-label="マイページ">
                    <UserAvatar
                      name={session.user.name ?? ""}
                      image={session.user.image}
                      className="h-8 w-8"
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
