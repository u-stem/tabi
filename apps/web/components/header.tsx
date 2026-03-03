"use client";

import type { FriendRequestResponse } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileText,
  HelpCircle,
  Keyboard,
  LogOut,
  MessageSquare,
  Newspaper,
  Settings,
  Shield,
  Smartphone,
  User,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const FeedbackDialog = dynamic(() =>
  import("@/components/feedback-dialog").then((mod) => mod.FeedbackDialog),
);

import { AnnouncementBanner } from "@/components/announcement-banner";
import { GuestBanner } from "@/components/guest-banner";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { signOut, useSession } from "@/lib/auth-client";
import { isGuestUser } from "@/lib/guest";
import { useInstallPrompt } from "@/lib/hooks/use-install-prompt";
import { usePushSubscription } from "@/lib/hooks/use-push-subscription";
import { MSG } from "@/lib/messages";
import { NAV_LINKS } from "@/lib/nav-links";
import { queryKeys } from "@/lib/query-keys";
import { useShortcutHelp } from "@/lib/shortcut-help-context";
import { cn } from "@/lib/utils";
import { switchViewMode } from "@/lib/view-mode";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { canInstall, promptInstall } = useInstallPrompt();
  const { open: openShortcutHelp } = useShortcutHelp();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
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

  async function handleSignOut() {
    try {
      await signOut();
      // Prevent stale data from previous account leaking into next session
      queryClient.clear();
      router.push("/");
    } catch {
      toast.error(MSG.AUTH_LOGOUT_FAILED);
    }
  }

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
          <ThemeToggle />
          {!mounted || !session?.user ? (
            <Skeleton className="h-8 w-8 rounded-full" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <UserAvatar
                    name={session.user.name ?? ""}
                    image={session.user.image}
                    className="h-8 w-8"
                  />
                  <span className="sr-only">ユーザーメニュー</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* Nav links: shown only below md breakpoint where header links are hidden */}
                {visibleNavLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild className="md:hidden py-2">
                    <Link href={link.href} className={cn(pathname === link.href && "font-medium")}>
                      <link.icon className="h-4 w-4" />
                      {link.label}
                      {link.href === "/friends" && friendRequestCount > 0 && (
                        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-xs font-medium tabular-nums text-destructive-foreground">
                          {friendRequestCount}
                        </span>
                      )}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="md:hidden" />
                <div className="flex items-center gap-3 px-2 py-2">
                  <UserAvatar
                    name={session.user.name ?? ""}
                    image={session.user.image}
                    className="h-9 w-9 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-none">{session.user.name}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {session.user.displayUsername
                        ? `@${session.user.displayUsername}`
                        : session.user.username
                          ? `@${session.user.username}`
                          : ""}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                {!isGuest && (
                  <>
                    <DropdownMenuItem asChild className="py-2">
                      <Link href={`/users/${session.user.id}`}>
                        <User className="h-4 w-4" />
                        プロフィール
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="py-2">
                      <Link href="/settings">
                        <Settings className="h-4 w-4" />
                        設定
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onClick={openShortcutHelp} className="py-2">
                  <Keyboard className="h-4 w-4" />
                  ショートカット
                  <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                    ?
                  </kbd>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFeedbackOpen(true)} className="py-2">
                  <MessageSquare className="h-4 w-4" />
                  フィードバック
                </DropdownMenuItem>
                {canInstall && (
                  <DropdownMenuItem onClick={promptInstall} className="py-2">
                    <Download className="h-4 w-4" />
                    アプリをインストール
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="py-2">
                  <Link href="/faq" target="_blank" rel="noopener noreferrer">
                    <HelpCircle className="h-4 w-4" />
                    よくある質問
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="py-2">
                  <Link href="/news" target="_blank" rel="noopener noreferrer">
                    <Newspaper className="h-4 w-4" />
                    お知らせ
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="py-2">
                  <Link href="/terms" target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4" />
                    利用規約
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="py-2">
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                    <Shield className="h-4 w-4" />
                    プライバシーポリシー
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {!/\/(print|export)(\/|$)/.test(pathname) && (
                  <DropdownMenuItem onClick={() => void switchViewMode("sp")} className="py-2">
                    <Smartphone className="h-4 w-4" />
                    SP版で表示
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleSignOut} className="py-2">
                  <LogOut className="h-4 w-4" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </nav>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </header>
  );
}
