"use client";

import type { FriendRequestResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SpUserMenuSheet } from "@/components/sp-user-menu-sheet";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { isGuestUser } from "@/lib/guest";
import { SP_NAV_LINKS } from "@/lib/nav-links";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

export function SpBottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const friendHref = "/sp/friends";
  const bookmarkHref = "/sp/bookmarks";
  const visibleLinks = SP_NAV_LINKS.filter(
    (link) => !isGuest || (link.href !== bookmarkHref && link.href !== friendHref),
  );

  return (
    <>
      <nav
        aria-label="ボトムナビゲーション"
        className="fixed inset-x-0 bottom-0 z-40 select-none border-t bg-background print:hidden"
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
          {/* Account tab: always rendered to keep layout stable, content conditional on session */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground transition-[colors,transform] active:bg-accent active:scale-[0.90]"
            aria-label="ユーザーメニュー"
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
            <span className="text-[10px] leading-none">アカウント</span>
          </button>
        </div>
      </nav>
      <SpUserMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
