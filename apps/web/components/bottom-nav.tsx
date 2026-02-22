"use client";

import type { FriendRequestResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { isGuestUser } from "@/lib/guest";
import { NAV_LINKS } from "@/lib/nav-links";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

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
    <nav
      aria-label="ボトムナビゲーション"
      className="fixed inset-x-0 bottom-0 z-40 select-none border-t bg-background sm:hidden print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-12 items-stretch">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-[colors,transform] active:bg-accent active:scale-[0.90]",
                active ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <link.icon className="h-5 w-5" />
              <span className="sr-only">{link.label}</span>
              {link.href === "/friends" && friendRequestCount > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                  {friendRequestCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
